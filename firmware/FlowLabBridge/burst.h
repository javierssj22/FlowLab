#pragma once
#include <esp_adc/adc_continuous.h>
#include <esp_timer.h>
#include <esp32-hal-periman.h>

// Acquisition is independent of HTTP, USB latency and browser scheduling.
// One finite burst per command, no outputs may be armed while sampling.
static uint16_t burstSamples[4096], preSamples[4096];
static volatile bool burstOverflow = false;
static uint32_t burstSequence = 0;
static bool IRAM_ATTR onBurstOverflow(adc_continuous_handle_t, const adc_continuous_evt_data_t*, void*) {
  burstOverflow = true;
  return false;
}
static void captureBurst(long id, const long* a) {
  int pin=a[0], rate=a[1], count=a[2], trigger=a[3], level=a[4], pre=a[5], timeout=a[6];
  if(armed || !permitted(pin) || !inList(pin,FL_ADC,sizeof(FL_ADC)/sizeof(int)) || !available(pin,4)
     || rate<20000 || rate>80000 || count<16 || count>4096 || trigger<0 || trigger>2
     || level<0 || level>4095 || pre<0 || pre>=count || (!trigger&&pre) || timeout<100 || timeout>5000) {
    fail(id,"Invalid burst or outputs armed; stop outputs before acquisition");return;
  }
  // Release Arduino's oneshot ADC handles before allocating the IDF DMA driver.
  // This API targets Arduino-ESP32 3.3.5. CI compiles all five profiles.
  for(int p=0;p<SOC_GPIO_PIN_COUNT;p++)if(modes[p]==4){
    if(!perimanClearPinBus(p)){fail(id,"Cannot release ADC oneshot driver");return;}modes[p]=0;
  }
  if(!perimanClearPinBus(pin)){fail(id,"Cannot claim ADC pin");return;}
  adc_unit_t unit;adc_channel_t channel;
  if(adc_continuous_io_to_channel(pin,&unit,&channel)!=ESP_OK || unit!=ADC_UNIT_1){fail(id,"Burst requires ADC1");return;}
  adc_continuous_handle_t handle=nullptr;
  adc_continuous_handle_cfg_t allocation={};allocation.max_store_buf_size=16384;allocation.conv_frame_size=512;
  if(adc_continuous_new_handle(&allocation,&handle)!=ESP_OK){fail(id,"ADC DMA allocation failed");return;}
  adc_digi_pattern_config_t pattern={};pattern.atten=ADC_ATTEN_DB_12;pattern.channel=channel;pattern.unit=unit;pattern.bit_width=SOC_ADC_DIGI_MAX_BITWIDTH;
  adc_continuous_config_t config={};config.sample_freq_hz=rate;config.conv_mode=ADC_CONV_SINGLE_UNIT_1;config.pattern_num=1;config.adc_pattern=&pattern;
#if CONFIG_IDF_TARGET_ESP32 || CONFIG_IDF_TARGET_ESP32S2
  config.format=ADC_DIGI_OUTPUT_FORMAT_TYPE1;
#else
  config.format=ADC_DIGI_OUTPUT_FORMAT_TYPE2;
#endif
  adc_continuous_evt_cbs_t callbacks={};callbacks.on_pool_ovf=onBurstOverflow;
  if(adc_continuous_config(handle,&config)!=ESP_OK || adc_continuous_register_event_callbacks(handle,&callbacks,nullptr)!=ESP_OK){
    adc_continuous_deinit(handle);fail(id,"ADC DMA configuration unsupported at requested rate");return;
  }
  burstOverflow=false;
  if(adc_continuous_start(handle)!=ESP_OK){adc_continuous_deinit(handle);fail(id,"ADC DMA start failed");return;}
  int64_t started=esp_timer_get_time();int collected=0,ringCount=0,ringNext=0,previous=-1;
  bool fired=trigger==0,failed=false;alignas(4) uint8_t buffer[512];
  while(collected<count && (esp_timer_get_time()-started)<(int64_t)timeout*1000 && !burstOverflow){
    uint32_t received=0;esp_err_t result=adc_continuous_read(handle,buffer,sizeof(buffer),&received,10);
    if(result==ESP_ERR_TIMEOUT)continue;
    if(result!=ESP_OK){failed=true;break;}
    for(uint32_t offset=0;offset+SOC_ADC_DIGI_RESULT_BYTES<=received;offset+=SOC_ADC_DIGI_RESULT_BYTES){
      const adc_digi_output_data_t* sample=(const adc_digi_output_data_t*)&buffer[offset];
#if CONFIG_IDF_TARGET_ESP32 || CONFIG_IDF_TARGET_ESP32S2
      int data=sample->type1.data, ch=sample->type1.channel;
#else
      int data=sample->type2.data, ch=sample->type2.channel;
#endif
      if(ch!=channel){failed=true;break;}
      // Normalize to 12 bits (S2's DMA conversion width differs from classic ESP32).
      if(SOC_ADC_DIGI_MAX_BITWIDTH>12)data>>=(SOC_ADC_DIGI_MAX_BITWIDTH-12);
      if(!fired && ringCount>=pre && previous>=0 && ((trigger==1&&previous<level&&data>=level)||(trigger==2&&previous>level&&data<=level))){
        for(int i=0;i<pre;i++)burstSamples[collected++]=preSamples[(ringNext+i)%pre];fired=true;
      }
      if(fired){burstSamples[collected++]=data;if(collected==count)break;}
      else if(pre){preSamples[ringNext]=data;ringNext=(ringNext+1)%pre;if(ringCount<pre)ringCount++;}
      previous=data;
    }
    if(failed)break;
  }
  adc_continuous_stop(handle);adc_continuous_deinit(handle);
  if(burstOverflow||failed){fail(id,"ADC overflow or invalid DMA frame; acquisition discarded");return;}
  if(collected!=count){fail(id,"Trigger/acquisition timeout; no partial waveform returned");return;}
  // Transfer only after acquisition stops, so serial throughput cannot distort dt.
  Serial.printf("{\"id\":%ld,\"ok\":true,\"value\":{\"kind\":\"waveform\",\"dt\":%.12f,\"t0\":%.12f,\"seq\":%lu,\"triggerIndex\":%d,\"unit\":\"ADC raw\",\"clock\":\"capture-relative\",\"rateNominal\":true,\"deviceStartUs\":%lld,\"samples\":[",id,1.0/rate,-(double)pre/rate,(unsigned long)++burstSequence,trigger?pre:-1,(long long)started);
  for(int i=0;i<count;i++){if(i)Serial.print(',');Serial.print(burstSamples[i]);}
  Serial.println("]}}");
}
