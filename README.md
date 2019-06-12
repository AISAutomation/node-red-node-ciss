# node-red-node-ciss
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node for using the BOSCH CISS sensor inside node-red. The following senor types are supported:
- Environmental sensor
- Light sensor
- Accelaration sensor
- Magnetometer
- Gyroscope 

## Installation

`npm install node-red-node-ciss`

## Quick Start

### SerialPort 

Setup Serialport inside the ciss node:

![config](images/config.PNG?raw=true)

### Create input message
You have to create an input message or switch with a topic (e.g. Environmental) to enable or disable a specific sensor.

![topic](images/topic.PNG?raw=true)


### Output

With on mouse-over you will get the tooltip with the sensor name at the outputs and connect e.g. with dashboard icons:

![sensor](images/sensor.PNG?raw=true)


## LICENSE

Licensed under the MIT License (MIT) License.
