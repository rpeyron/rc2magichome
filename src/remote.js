/** @typedef {object} Remote - Remote control definition
 *  @property {string} [title] - Optional title of the remote
 *  @property {string|Array<string>} rc - Remote control identifier code
 *  @property {string | Array<string>} [toggle] - If set, device or list of device to be toggled by the remote control
 *  @property {Array<string>} [devices] - If set, list of device to be controlled by the remote control
 *  @property {(devices: Array<import("./device").DeviceInterface|undefined>, states: Array<import("./device").DeviceState|undefined>) => Promise<void>} [function] - If set, the custom function to be run on the devices list
 *  @property {number | undefined} [lastCommandDate] - Last command timestamp
 */


/** Execute the remote command according to its definition
 * 
 * @argument {Remote} remote
 * */
export async function remoteExecute(remote, cache) {
    try {
        console.log(`Remote ${remote.title} (${remote.rc}) pressed - ${new Date().toISOString()}`)	
   
        // Toggle mode
        if (remote.toggle && remote.toggle.length > 0) {
          let devices = cache.getDevicesFromDeviceTitles(Array.isArray(remote.toggle)?remote.toggle:[remote.toggle])
          let states = await Promise.all(devices.map(d => d && d.getState()))
          let targetState = !states.reduce((cur, val) => cur || (!!val && val.on), false);
          await Promise.all(devices.map(async d => {
            await d?.setPower(targetState)
          }))
        }
    
        // Function mode
        if (remote.devices && remote.function && typeof remote.function === "function") {
          let devices = cache.getDevicesFromDeviceTitles(remote.devices)
          let states = await Promise.all(devices.map(d => d && d.getState()))
          await remote.function(devices, states)
        }
  
    } catch(e) {
      console.error("Error in rcCommand", e)
    }
  }
  