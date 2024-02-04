#!/usr/bin/env node
import { connect } from 'mqtt';

import config from './src/config.js';
import { DeviceCache } from './src/devices-cache.js';
import { remoteExecute } from './src/remote.js';

import { existsSync } from 'fs';
import path from "path";

const LOCALCONFIG = "config.local.js"

const importUrl = new URL(import.meta.url)
importUrl.pathname = path.join(importUrl.pathname, "..", LOCALCONFIG)
const localConfigUrl = importUrl.href

// Apply local config if it exists
// To create a local config, copy src/config.js as template, tename it to config.local.js and remove what you don't need and define what you 
try {
  let localConfig = await import(localConfigUrl)
  Object.assign(config, localConfig?.default)
  console.log("Using config: ",config,"\n\n");
} catch(e) {
  console.log("No local config found ", localConfigUrl);
}

let deviceCache = new DeviceCache(config.devices, config)

const client = connect(config.mqttConnectString);

function ensureConnected() {
  if (!client.connected) client.on("connect", () => {
    client.subscribe("rc", (err) => {
      if (!err) {
        console.log("Successfully connected to MQTT")
      }
    });
  }); 
}

ensureConnected()
setInterval(ensureConnected, config.checkConnectionIntervalMs)

client.on('close', function() {
  console.log('Client disconnected');
});

client.on("message", (topic, message) => {
  if (topic == "rc") {
    let rc = message.toString()
    let matchingRemotes = config.remotes.filter(r => Array.isArray(r.rc)?r.rc.includes(rc):r.rc == rc)
    if (matchingRemotes.length > 0) {
      matchingRemotes.forEach(remote => remoteExecute(remote, deviceCache))
    } else {
      console.error(`Remote ${rc} not found in config`)
    }
  }
});