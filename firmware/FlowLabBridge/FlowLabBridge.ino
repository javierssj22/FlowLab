// FlowLab serial bridge, MIT license. Arduino-ESP32 3.x, no third-party libraries.
#include <Arduino.h>
#include <Wire.h>
#include <driver/gpio.h>
#include <soc/soc_caps.h>
#include <errno.h>
#include "profiles.h"

static char lineBuffer[512];
static size_t lineLength = 0;
static bool overflowLine = false;
static uint8_t modes[SOC_GPIO_PIN_COUNT] = {};
static uint32_t frequencies[SOC_GPIO_PIN_COUNT] = {};
static unsigned long lastCommand = 0;
static bool i2cReady = false;
static bool watchdogTripped = false;
static bool armed = false;
static int busSda = -1, busScl = -1;

bool inList(int pin, const int* pins, size_t count) {
  for (size_t i=0;i<count;i++) if (pins[i]==pin) return true;
  return false;
}
bool permitted(int pin, bool output=false) {
  return pin>=0 && pin<SOC_GPIO_PIN_COUNT && GPIO_IS_VALID_GPIO(pin)
    && inList(pin, FL_GPIO, sizeof(FL_GPIO)/sizeof(int))
    && (!output || GPIO_IS_VALID_OUTPUT_GPIO(pin));
}
bool available(int pin, uint8_t mode) { return modes[pin]==0 || modes[pin]==mode; }
void fail(long id, const char* reason) {
  Serial.printf("{\"id\":%ld,\"ok\":false,\"error\":\"%s\"}\n", id, reason);
}
void reply(long id, long value=0) {
  Serial.printf("{\"id\":%ld,\"ok\":true,\"value\":%ld}\n", id, value);
}
#include "burst.h"
#include "peripherals.h"
void stopOutputs() {
  for (int pin=0;pin<SOC_GPIO_PIN_COUNT;pin++) {
    if (modes[pin]==3 || (modes[pin]==8&&frequencies[pin])) { ledcWrite(pin,0); ledcDetach(pin); }
#if SOC_DAC_SUPPORTED
    if(modes[pin]==6){dacWrite(pin,0);dacDisable(pin);}
#endif
    if (modes[pin]==2 || modes[pin]==3 || modes[pin]==6 || modes[pin]==8) { pinMode(pin,OUTPUT); digitalWrite(pin,LOW); }
    if(modes[pin]==4||modes[pin]==7)perimanClearPinBus(pin);
    modes[pin]=0;frequencies[pin]=0;
  }
  if (i2cReady) Wire.end();
  i2cReady=false;busSda=busScl=-1;
}
bool parseLong(char* token,long &value) {
  if (!token || !*token) return false;
  char* end;errno=0;value=strtol(token,&end,10);
  return errno==0 && *end=='\0';
}
void dispatch(char* line) {
  char* state=nullptr;
  long id=0, a[36]={};
  if (!parseLong(strtok_r(line," \r",&state),id) || id<1) { fail(0,"Invalid request id");return; }
  char* command=strtok_r(nullptr," \r",&state);
  if (!command) {fail(id,"Missing command");return;}
  size_t count=0;char* token;
  while ((token=strtok_r(nullptr," \r",&state))) {
    if(count>=36 || !parseLong(token,a[count])) {fail(id,"Invalid arguments");return;}count++;
  }
  if(watchdogTripped && strcmp(command,"stop") && strcmp(command,"hello")) {fail(id,"Watchdog expired: stop and restart the flow");return;}
  if (!strcmp(command,"hello") && count==0) {
    Serial.printf("{\"id\":%ld,\"ok\":true,\"value\":{\"protocol\":3,\"family\":\"%s\",\"chip\":\"%s\",\"watchdogMs\":2000,\"capabilities\":[\"adc-burst-dma\",\"i2c-multibyte\"],\"maxSamples\":4096,\"maxI2cBytes\":32}}\n",id,FL_FAMILY,ESP.getChipModel());
  } else if (!strcmp(command,"stop") && count==0) {stopOutputs();watchdogTripped=false;armed=false;reply(id);}
  else if (!strcmp(command,"ping") && count==0) {reply(id,millis());}
  else if (!strcmp(command,"burst") && count==7) {captureBurst(id,a);}
  else if (!strcmp(command,"dac") && count==2) {writeDac(id,a);}
  else if (!strcmp(command,"touch") && count==1) {readTouch(id,a);}
  else if (!strcmp(command,"tone") && count==2) {writeTone(id,a);}
  else if (!strcmp(command,"pcnt") && count==3) {capturePcnt(id,a);}
  else if (!strcmp(command,"i2cxfer") && count>=4) {
    int address=a[0],tx=a[1],rx=a[2],stop=a[3];
    if(!i2cReady||address<8||address>119||tx<0||tx>32||rx<0||rx>32||(!tx&&!rx)||(stop!=0&&stop!=1)||count!=(size_t)(4+tx)){fail(id,"Invalid I2C frame");return;}
    for(int i=0;i<tx;i++)if(a[4+i]<0||a[4+i]>255){fail(id,"Invalid I2C byte");return;}
    if(tx){Wire.beginTransmission(address);for(int i=0;i<tx;i++)Wire.write((uint8_t)a[4+i]);
      if(Wire.endTransmission(rx?stop:true)!=0){fail(id,"I2C NACK or timeout");return;}}
    uint8_t result[32];
    if(rx){size_t got=Wire.requestFrom((uint8_t)address,(size_t)rx,true);if(got!=(size_t)rx){while(Wire.available())Wire.read();fail(id,"I2C short read");return;}
      for(int i=0;i<rx;i++)result[i]=Wire.read();}
    Serial.printf("{\"id\":%ld,\"ok\":true,\"value\":[",id);for(int i=0;i<rx;i++){if(i)Serial.print(',');Serial.print(result[i]);}Serial.println("]}");
  }
  else if (!strcmp(command,"adc") && count==2) {
    int pin=a[0];
    if(!permitted(pin) || !inList(pin,FL_ADC,sizeof(FL_ADC)/sizeof(int)) || !available(pin,4) || (a[1]!=0&&a[1]!=1)) {fail(id,"Invalid ADC pin/mode or pin busy");return;}
    modes[pin]=4;pinMode(pin,INPUT);
    reply(id,a[1]?analogReadMilliVolts(pin):analogRead(pin));
  } else if (!strcmp(command,"read") && count==2) {
    int pin=a[0];
    if(!permitted(pin) || !available(pin,1) || a[1]<0 || a[1]>2 || (!GPIO_IS_VALID_OUTPUT_GPIO(pin)&&a[1]!=0)) {fail(id,"Invalid input or pin busy");return;}
    modes[pin]=1;pinMode(pin,a[1]==1?INPUT_PULLUP:a[1]==2?INPUT_PULLDOWN:INPUT);reply(id,digitalRead(pin));
  } else if (!strcmp(command,"write") && count==2) {
    int pin=a[0];
    if(!permitted(pin,true) || !available(pin,2) || (a[1]!=0&&a[1]!=1)) {fail(id,"Invalid output or pin busy");return;}
    modes[pin]=2;armed=true;pinMode(pin,OUTPUT);digitalWrite(pin,a[1]);reply(id,a[1]);
  } else if (!strcmp(command,"pwm") && count==3) {
    int pin=a[0];
    if(!permitted(pin,true)||!available(pin,3)||hasMode(8)||a[1]<0||a[1]>255||a[2]<100||a[2]>20000) {fail(id,"Invalid PWM, Tone conflict or pin busy");return;}
    if(modes[pin]==3 && frequencies[pin]!=(uint32_t)a[2]) {fail(id,"Stop before changing PWM frequency");return;}
    if(modes[pin]!=3 && !ledcAttach(pin,a[2],8)) {fail(id,"LEDC channel/frequency unavailable");return;}
    modes[pin]=3;armed=true;frequencies[pin]=a[2];
    if(!ledcWrite(pin,a[1])) {fail(id,"LEDC write failed");return;}reply(id,a[1]);
  } else if (!strcmp(command,"i2c") && count==2) {
    int sda=a[0],scl=a[1];
    if(!permitted(sda,true)||!permitted(scl,true)||sda==scl||!available(sda,5)||!available(scl,5)) {fail(id,"Invalid I2C pins or pins busy");return;}
    if(i2cReady) {Wire.end();modes[busSda]=modes[busScl]=0;i2cReady=false;}
    if(!Wire.begin(sda,scl,100000)) {fail(id,"I2C begin failed");return;}
    Wire.setTimeOut(10);i2cReady=true;busSda=sda;busScl=scl;modes[sda]=modes[scl]=5;reply(id);
  } else if (!strcmp(command,"scan") && count==0) {
    if(!i2cReady) {fail(id,"Configure I2C first");return;}
    Serial.printf("{\"id\":%ld,\"ok\":true,\"value\":[",id);bool comma=false;
    for(int address=8;address<=119;address++) {
      Wire.beginTransmission(address);
      if(Wire.endTransmission()==0) {if(comma)Serial.print(',');Serial.print(address);comma=true;}
    }
    Serial.println("]}");
  } else if ((!strcmp(command,"i2cread")&&count==2)||(!strcmp(command,"i2cwrite")&&count==3)) {
    if(!i2cReady||a[0]<8||a[0]>119||a[1]<0||a[1]>255||(count==3&&(a[2]<0||a[2]>255))) {fail(id,"Invalid I2C request or bus not configured");return;}
    Wire.beginTransmission((uint8_t)a[0]);Wire.write((uint8_t)a[1]);
    if(count==3) Wire.write((uint8_t)a[2]);
    if(Wire.endTransmission(count==3)!=0) {fail(id,"I2C NACK or timeout");return;}
    if(count==3) reply(id,a[2]);
    else {if(Wire.requestFrom((uint8_t)a[0],(size_t)1,true)!=1) {fail(id,"I2C read failed");return;}reply(id,Wire.read());}
  } else {fail(id,"Unknown command or wrong argument count");return;}
  lastCommand=millis();
}
void setup() {
  Serial.begin(115200);analogReadResolution(12);lastCommand=millis();
}
void loop() {
  if(armed && (unsigned long)(millis()-lastCommand)>2000) {stopOutputs();armed=false;watchdogTripped=true;}
  // Bound work per iteration so a noisy UART cannot starve the watchdog.
  int budget=256;
  while(Serial.available() && budget-->0) {
    char c=Serial.read();
    if(c=='\n') {
      if(overflowLine) fail(0,"Line too long");
      else {lineBuffer[lineLength]='\0';dispatch(lineBuffer);}
      lineLength=0;overflowLine=false;
    } else if(!overflowLine) {
      if(lineLength+1<sizeof(lineBuffer)) lineBuffer[lineLength++]=c;
      else overflowLine=true;
    }
  }
  delay(1);
}
