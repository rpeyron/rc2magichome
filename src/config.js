
export default {
    /** @type string - MQTT connection string */
    mqttConnectString: "mqtt://localhost",
    /** @type string - MQTT topic to get remote commands codes */
    mqttConnectTopic: "rc",
    /** @type string - MQTT topic to send detected remote (not published if undefined) */
    mqttRemotePublishTopic: undefined,
    /** @type number - Interval in ms to update device states */
    updateStatesIntervalMs: 5000,
    /** @type number - Interval in ms to scan for new devices */
    scanIntervalMs: 5000,
    /** @type number - Timeout in ms to be used to scan for new devices */
    scanTimeoutMs: 2000,
    /** @type number - Interval in ms to check connection */
    checkConnectionIntervalMs: 5000,
    /** @type number - Max number of retries of calls to magichome LED */
    retriesMax: 5,
    /** @type number - Sleep in ms between retries */
    retriesSleepMs: 200,
    /** @type number - Delay in ms before querying to update cached states */
    delayBeforeUpdateStateMs: 50,
    /** @type number - Delay in ms before a new command */
    delayBetweenCommandsMs: 400,

    /** @type Array<import("./devices-cache").DeviceDefinition> */
    devices: [
        { title: "MyDevice1", id: "0123456789AB", address: "192.168.1.15" },
        { title: "MyDevice2", id: "0123456789CA", address: "192.168.1.16" },
    ],

    /** @type Array<import("./remote").Remote> */
    remotes: [
        /* Example for a simple (and most common) switch for a set of devices */
        {
            title: "MyToggleSwitch",
            rc: "1234567",
            toggle: ["MyDevice1"],
        },
        /* Example of more advanced custom function on a set of devices to have multiple levels on the same switch */
        {
            title: "MyCustomSwitch",
            rc: "124781",
            devices: ["MyDevice1", "MyDevice2"],
            function: async (devices, states) => {
                let curState = states[0]
                if (!curState?.on) {
                  devices.forEach(async d => d && await d.setWhite(10) && await d.setPower(true))
                } else if (curState?.on && (curState?.white == 10 || curState?.white == 255)) {
                  devices[0]?.setWhite(20)
                  devices[1]?.setWhite(100)
                } else if (curState?.on && (curState?.white == 50)) {
                  devices[0]?.setWhite(255)
                  devices[1]?.setWhite(255)
                } else {
                  devices[0]?.setWhite(50)
                  devices[1]?.setWhite(255)
                }
              }
        },
    ],
}

