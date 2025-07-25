# CalcAI Management Dashboard

A device management dashboard for CalcAI ESP32 devices with OTA (Over-The-Air) update capabilities.

## Features

- **Device Registration & Monitoring** - Track ESP32 devices with advanced status
- **OTA Firmware Updates** - Upload and deploy firmware remotely
- **Advanced ESP32 Status** - Memory, CPU, WiFi, temperature monitoring
- **Real-time Dashboard** - Web interface for device management

## Advanced ESP32 Monitoring

- Memory usage and heap statistics
- CPU frequency monitoring  
- WiFi signal strength with quality indicators
- Network configuration details
- Internal temperature monitoring
- Uptime tracking
- Reset reason analysis

## Deployment

Deployed on Railway at: https://calcai-management-dashboard-production.up.railway.app

## Usage

1. ESP32 devices automatically register when connecting to WiFi
2. Upload firmware .bin files through the dashboard
3. Push updates to individual devices or all devices
4. Monitor device health and status in real-time
5. Click "+" button on device cards for detailed ESP32 status

## API Endpoints

- `POST /api/devices/register` - Device registration with advanced status
- `GET /api/devices/list` - Get all registered devices
- `POST /api/ota/upload` - Upload firmware files
- `POST /api/ota/push-update` - Push updates to devices
- `GET /api/devices/firmware/:version` - Download firmware files
