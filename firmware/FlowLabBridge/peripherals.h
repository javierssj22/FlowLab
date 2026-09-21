// SPDX-License-Identifier: MIT
#pragma once
#include <esp_timer.h>
#if SOC_PCNT_SUPPORTED
#include <driver/pulse_cnt.h>
#endif

bool hasMode(uint8_t mode, int except=-1) {
  for(int pin=0;pin<SOC_GPIO_PIN_COUNT;pin++)if(pin!=except && modes[pin]==mode)return true;
  return false;
}

void capturePcnt(long id, long* a) {
#if SOC_PCNT_SUPPORTED
  const int pin=a[0];
  if(!permitted(pin)||!available(pin,0)||a[1]<10||a[1]>1000||a[2]<0||a[2]>10000){fail(id,"Invalid PCNT input, gate, filter or pin busy");return;}
  pcnt_unit_handle_t unit=nullptr;pcnt_channel_handle_t channel=nullptr;
  bool enabled=false,started=false;esp_err_t err=ESP_OK;int pulses=0;
  int64_t elapsed=0;
  pcnt_unit_config_t config={};config.low_limit=-32767;config.high_limit=32767;config.flags.accum_count=true;
  pcnt_chan_config_t chan={};chan.edge_gpio_num=pin;chan.level_gpio_num=-1;
  pcnt_glitch_filter_config_t filter={};filter.max_glitch_ns=a[2];
  // Both limit watch points feed the driver's software accumulator on overflow.
  do {
    err=pcnt_new_unit(&config,&unit);if(err!=ESP_OK)break;
    err=pcnt_unit_add_watch_point(unit,config.low_limit);if(err!=ESP_OK)break;
    err=pcnt_unit_add_watch_point(unit,config.high_limit);if(err!=ESP_OK)break;
    err=pcnt_new_channel(unit,&chan,&channel);if(err!=ESP_OK)break;
    err=pcnt_channel_set_edge_action(channel,PCNT_CHANNEL_EDGE_ACTION_INCREASE,PCNT_CHANNEL_EDGE_ACTION_HOLD);if(err!=ESP_OK)break;
    err=pcnt_channel_set_level_action(channel,PCNT_CHANNEL_LEVEL_ACTION_KEEP,PCNT_CHANNEL_LEVEL_ACTION_KEEP);if(err!=ESP_OK)break;
    if(a[2]){err=pcnt_unit_set_glitch_filter(unit,&filter);if(err!=ESP_OK)break;}
    err=pcnt_unit_enable(unit);if(err!=ESP_OK)break;enabled=true;
    err=pcnt_unit_clear_count(unit);if(err!=ESP_OK)break;
    err=pcnt_unit_start(unit);if(err!=ESP_OK)break;started=true;
    const int64_t begin=esp_timer_get_time();
    while(esp_timer_get_time()-begin<a[1]*1000LL)delay(1);
    err=pcnt_unit_stop(unit);elapsed=esp_timer_get_time()-begin;if(err!=ESP_OK)break;started=false;
    err=pcnt_unit_get_count(unit,&pulses);
  }while(false);
  if(started)pcnt_unit_stop(unit);
  if(enabled)pcnt_unit_disable(unit);
  if(channel)pcnt_del_channel(channel);
  if(unit)pcnt_del_unit(unit);
  if(err!=ESP_OK||elapsed<=0||pulses<0){fail(id,"PCNT driver, resource or filter error");return;}
  Serial.printf("{\"id\":%ld,\"ok\":true,\"value\":%.9f}\n",id,pulses*1000000.0/elapsed);
#else
  fail(id,"PCNT not available on this SoC");
#endif
}

void writeDac(long id,long* a) {
#if SOC_DAC_SUPPORTED
  const int pin=a[0];
  if(!permitted(pin,true)||!inList(pin,FL_DAC,sizeof(FL_DAC)/sizeof(int))||!available(pin,6)||a[1]<0||a[1]>255){fail(id,"Invalid DAC pin, value or pin busy");return;}
  if(!dacWrite(pin,(uint8_t)a[1])){fail(id,"DAC write failed");return;}
  modes[pin]=6;armed=true;reply(id,a[1]);
#else
  fail(id,"DAC not available on this SoC");
#endif
}
void readTouch(long id,long* a) {
#if SOC_TOUCH_SENSOR_SUPPORTED
  const int pin=a[0];
  if(!permitted(pin)||!inList(pin,FL_TOUCH,sizeof(FL_TOUCH)/sizeof(int))||!available(pin,7)){fail(id,"Invalid Touch pin or pin busy");return;}
  const uint32_t value=touchRead(pin);modes[pin]=7;
  Serial.printf("{\"id\":%ld,\"ok\":true,\"value\":%lu}\n",id,(unsigned long)value);
#else
  fail(id,"Touch not available on this SoC");
#endif
}
void writeTone(long id,long* a) {
  const int pin=a[0];const uint32_t frequency=a[1];
  if(!permitted(pin,true)||!available(pin,8)||a[1]<0||a[1]>20000||(frequency&&frequency<20)||hasMode(3)||hasMode(8,pin)){fail(id,"Invalid Tone, pin busy or PWM/timer conflict");return;}
  if(!frequency){
    if(modes[pin]==8){ledcWrite(pin,0);ledcDetach(pin);}pinMode(pin,OUTPUT);digitalWrite(pin,LOW);modes[pin]=8;frequencies[pin]=0;reply(id);return;
  }
  if(!frequencies[pin]&&!ledcAttach(pin,1000,10)){fail(id,"No LEDC channel for Tone");return;}
  modes[pin]=8;armed=true;
  const uint32_t actual=ledcWriteTone(pin,frequency);
  if(!actual){ledcWrite(pin,0);ledcDetach(pin);pinMode(pin,OUTPUT);digitalWrite(pin,LOW);frequencies[pin]=0;fail(id,"Tone frequency unsupported by LEDC clock");return;}
  frequencies[pin]=actual;reply(id,actual);
}
