import { Discovery, Control } from 'magic-home'
import { DeviceControl } from './device.js'


/** @typedef {object} DeviceDefinition  
 *  @property {string} title - The device title
 *  @property {string} id - The device id
 *  @property {string} address - The device address
 */

/** @typedef {object} ConfigDeviceCache 
 * @property {number} scanIntervalMs - Interval in ms to scan for new devices
 * @property {number} scanTimeoutMs - Timeout in ms to be used to scan for new devices
 * @property {number} updateStatesIntervalMs - Interval in ms to update device states
 */


export class DeviceCache {

    /** @type Array<DeviceDefinition> */
    devicesCache
    /** @type Map<string, Control.QueryResponse> */
    statesCache = new Map()
    /** @type Map<string, number> */
    statesCacheIgnoreUpdates = new Map()
    /** @type {ConfigDeviceCache} */
    config

    /**
     * @argument {Array<DeviceDefinition>} defaultDevices
     * @argument {ConfigDeviceCache} config
     */
    constructor(defaultDevices, config) {
        this.devicesCache = defaultDevices ?? []
        this.config = config
        this.startCache()
    }

    startCache() {
        // Discover devices periodically
        this.updateDevicesMap()
        setInterval(this.updateDevicesMap.bind(this), this.config.scanIntervalMs)
        
        // Update device states periodically
        this.updateDevicesState()
        setInterval(this.updateDevicesState.bind(this), this.config.updateStatesIntervalMs ?? this.config.scanIntervalMs)

    }

    updateDevicesMap() {
        Discovery.scan(this.config.scanTimeoutMs).then((devices) => {
            // console.log("updateDevicesMap", devices)
            devices.forEach(async device => {
                //console.log("Discovered device: " + device.id + " (" + device.address + ")" + " [" + device.model + "]")
                // Manage device cache
                let foundDevice = this.devicesCache.find((dev) => dev.id === device.id)
                if (!foundDevice) {
                    console.log("Discovered device: " + device.id + " (" + device.address + ")" + " [" + device.model + "]") ;
                    this.devicesCache.push({ title: device.model, id: device.id, address:device.address })
                } else if (foundDevice.address !== device.address) {
                    console.log("Updated device " + foundDevice.title + " : " + device.id + " (" + device.address + ")" + " [" + device.model + "]") ;
                    foundDevice.address = device.address;
                }
                // State cache
                try {
                    let reqTimestamp = Date.now()
                    this.updateStatusCache(device.id, await new Control(device.address).queryState(), reqTimestamp)
                } catch(e) { /* silent ignore caching error */ }
            })
        })
    }
      
    /**
     * Update the cache with a new state that was requested at reqTimestamp
     * 
     * @param {string} deviceId 
     * @param {Control.QueryResponse} newState 
     * @param {number} reqTimestamp
     */
    updateStatusCache(deviceId, newState, reqTimestamp) {
        let ignoreUpdate = this.statesCacheIgnoreUpdates.get(deviceId)
        if (ignoreUpdate && ignoreUpdate > reqTimestamp) {
            console.log("Ignoring updated state called before last command")
            return
        }
        
        let prevState = this.statesCache.get(deviceId)
        this.statesCache.set(deviceId, newState)
        if (prevState && newState) {
            if (prevState.on != newState.on 
            || prevState.color?.red != newState.color?.red
            || prevState.color?.blue != newState.color?.blue
            || prevState.color?.green != newState.color?.green
            || prevState.warm_white != newState.warm_white
            ) {
                console.log("State updated for "+ this.devicesCache.find(d => d.id === deviceId)?.title + " : " +JSON.stringify(newState))
            }
        }
    }
    
    /**
     * Clear status cache for given deviceId
     * 
     * @param {string} deviceId 
     */
    clearStatusCache(deviceId) {
        this.statesCache.delete(deviceId)
        this.statesCacheIgnoreUpdates.set(deviceId, Date.now()) 
    }
    
    updateDevicesState() {
        this.devicesCache.forEach(async device => {
            try {
                let reqTimestamp = Date.now()
                this.updateStatusCache(device.id, await new Control(device.address).queryState(), reqTimestamp)
            } catch(e) { /* silent ignore caching error */ }
        })
    }

    
    getDeviceFromCachedId(id) {
        let d = this.devicesCache.find(d => d.id === id)
        if (d) return new DeviceControl(d.id, new Control(d.address), d.title, this)
        return undefined
      }
    
      getDeviceFromCachedTitle(title) {
        let d = this.devicesCache.find(d => d.title === title)
        if (d) return new DeviceControl(d.id, new Control(d.address), d.title, this)
        return undefined
      }
    
      /**
       * 
       * @param {string[]} devicesTitles 
       * @returns {(DeviceControl|undefined)[]}
       */
      getDevicesFromDeviceTitles(devicesTitles) {
        return devicesTitles.map(d => this.getDeviceFromCachedTitle(d))
      }

      getStatesCache() {
         return this.statesCache
      }

      getDevicesCache() {
        return this.devicesCache
      }
    

}



