// FlowLab 0.3 — standalone export — MIT
// Target: esp32. Arduino-ESP32 3.x.
// Controls are frozen at export time. Instrument output: time_s,node_id,value.
// Runs continuously after boot; host stop/watchdog is not used in standalone mode.
// Review the GPIO wiring before upload.
#include <Arduino.h>
#include <Wire.h>
#include <math.h>

void printCsvText(const String &value) { Serial.write(34); for(unsigned int i=0;i<value.length();i++){if(value[i]==34)Serial.write(34);Serial.write(value[i]);} Serial.write(34); }
struct PIDState { double integral=0, previous=0; bool initialized=false; };
// Explicit prototypes keep Arduino's preprocessor compatible with the custom struct.
double pid(PIDState &s,double setpoint,double pv,double dt,double kp,double ki,double kd,double low,double high);
void fatal(const char* message);
double limit(double v,double low,double high) { return fmax(low,fmin(high,v)); }
double wave(double t,double hz,double phase,int shape) {
  double x=t*hz+phase/(2*PI), f=x-floor(x);
  if(shape==0)return sin(2*PI*x);
  if(shape==1)return f<0.5?1:-1;
  if(shape==2)return 1-4*fabs(f-0.5);
  return 2*f-1;
}
double pid(PIDState &s,double setpoint,double pv,double dt,double kp,double ki,double kd,double low,double high) {
  if(!s.initialized){s.previous=pv;s.initialized=true;}
  double error=setpoint-pv, integral=s.integral+error*dt;
  double raw=kp*error+ki*integral-kd*(pv-s.previous)/dt, out=limit(raw,low,high);
  if(raw==out||(raw>high&&ki*error<0)||(raw<low&&ki*error>0))s.integral=integral;
  s.previous=pv;return out;
}
void fatal(const char* message) {

  Serial.print("ERROR: ");Serial.println(message);
  while(true)delay(1000);
}

double s_v1=0; bool initialized_v1=false;
uint32_t lastTick=0;
double t=0;
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  Serial.println("time_s,node_id,value");
  lastTick=millis();
}
void loop() {
  uint32_t now=millis(), elapsed=now-lastTick;
  if(elapsed<50){delay(1);return;}
  lastTick=now;double dt=elapsed/1000.0;
  double v0 = wave(t, 0.4, 0.0, 0) * 1.4 + 1.65; // signal
  if (!isfinite(v0)) fatal("Non-finite value at source");
  double v1 = initialized_v1 ? s_v1+(1-exp(-dt/0.2))*((double)v0-s_v1) : (double)v0; // filter
  if (!isfinite(v1)) fatal("Non-finite value at filter");
  s_v1=v1; initialized_v1=true;
  double v2 = (double)v1; // chart
  if (!isfinite(v2)) fatal("Non-finite value at scope");
  Serial.print(t,6); Serial.print(",scope,"); Serial.println((double)v2,6);
  double v3 = (double)v1; // gauge
  if (!isfinite(v3)) fatal("Non-finite value at meter");
  Serial.print(t,6); Serial.print(",meter,"); Serial.println((double)v3,6);
  double v4 = 2.2; // constant
  if (!isfinite(v4)) fatal("Non-finite value at limit");
  bool v5 = (double)v1 > (double)v4; // compare
  bool v6 = v5; // led
  Serial.print(t,6); Serial.print(",led,"); Serial.println((double)v6,6);
  double v7 = (double)v1; // log
  if (!isfinite(v7)) fatal("Non-finite value at log");
  Serial.print(t,6); Serial.print(",log,"); Serial.println((double)v7,6);

  t+=dt;
}
