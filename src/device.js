
import { Control } from 'magic-home'
import { sleep } from './helpers.js';
import config from './config.js';

/** @typedef {import("./devices-cache").DeviceCache} DeviceCache */

/** @typedef {object} DeviceState 
 *  @property {boolean} on
 *  @property {number} white
 */

/** @typedef {object} DeviceInterface 
 *  @property {(state: boolean) => Promise<boolean>} setPower
 *  @property {(white: number) => Promise<boolean>} setWhite
 *  @property {() => Promise<DeviceState>} getState
 */

/** 
 * @class 
 * @implements DeviceInterface
 * */
export class DeviceControl {

    /** @type string */
    id;
  
    /** @type Control */
    control;
  
    /** @type string */
    title;
  
    /** @type {DeviceCache} */
    cache;
  
    /** 
     * @param {string} id
     * @param {Control} control 
     * @param {DeviceCache} cache
     *  */
    constructor(id, control, title, cache) {
      this.id = id
      this.control = control
      this.title = title ?? ""
      this.cache = cache
    }
  
  
    setPower(on) { return this._controlRetryFunction("setPower")(on) }
    setWhite(white) { return this._controlRetryFunction( "setColor")(white,0,0) } 
    async getState(useCache = true) { 
      if (useCache) {
        let cache = this.getCachedState()
        if (cache) return cache
      }
      console.log("No cached state for " + this.getTitle() + ", querying state")
      return mapControlStateToDeviceState(await this.control.queryState())
    }
  
    getCachedState() { 
      let state = this.cache.getStatesCache().get(this.id)
      if (state) return mapControlStateToDeviceState(state) 
      return undefined
    }
  
    getTitle() {
      return this.cache.getDevicesCache().find(d => d.id === this.id)?.title ?? this.id
    }
  
    /**
     * @param {string} functionName 
     */
    _controlRetryFunction(functionName, ignoreCache = false) {
      let control = this.control
      return async (...args) => {
        if (control && control[functionName] && typeof control[functionName] === "function") {
          let retry = config.retriesMax;
          /** @type any | undefined */
          let response = undefined
          async function functionCall() {
            response = await control[functionName](...args)
          }
          this.cache.clearStatusCache(this.id)
          while (retry-- > 0) {
            try {
              await functionCall()
              retry = -10
            } catch(e) {
              if (retry == 0) console.error(e)
            }
          }
          if (!ignoreCache) this.updateDeviceCache()
          return response
        }
        return undefined
      }
    }
  
    async updateDeviceCache() {
      await sleep(config.delayBeforeUpdateStateMs)
      try {
        let reqTimestamp = Date.now()
        let state = await this.control.queryState()
        if (state) this.cache.updateStatusCache(this.id,state, reqTimestamp)  
      } catch(e) { /* silent ignore caching error */ }
    }
  
  } 
  
  /** @argument {Control.QueryResponse} controlState
   * @returns {DeviceState}
  */
  function mapControlStateToDeviceState(controlState) {
    return {
      on: controlState.on,
      white: controlState.color.red,
    }
  }
  