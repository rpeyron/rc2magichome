#!/usr/bin/env python3
"""rc_lights — minimal Home Assistant helper (python_scripts).

This script maps remote codes (RC) to light actions and is intended to be
called from Home Assistant via `python_scripts`.

Configuration

```python
config = {
    # map friendly names to entity_ids
    "lights": {
        "chambre1": "light.controller_dimmable_5d0c78",
        "salon": "light.controller_dimmable_437607",
    },

    # remotes: map raw RC code (int or str) to a logical remote alias
    # Example: 13923313 -> "chambre_droit"
    "remotes": {
        13923313: "chambre_droit",
        13923314: "chambre_gauche",
    },

    # commands: list of actions triggered by remotes (refer to remote aliases)
    "commands": [
        {
            "title": "Toggle chambre",
            "remotes": ["chambre_droit", "lit_milieu"],  # remote aliases
            "lights": ["chambre1", "chambre2"],          # entries from `lights` map or entity_ids
            "command": "toggle"                          # "toggle" or "cycle"
        },
        {
            "title": "Cycle jour",
            "remotes": ["chambre_gauche"],
            "lights": ["chambre1", "chambre2"],
            "command": "cycle",
            "cycles": [[20,100],[50,255],[255,255]]       # list of brightness vectors
        }
    ]
}
```

Key behaviour
- `lights` entries may be either a Home Assistant entity_id (contain a dot)
    or a friendly key resolved via the `lights` mapping above.
- `remotes` maps raw codes received from your RF/MQTT event to logical names
    used in `commands[*].remotes`.
- `commands` entries define which remotes trigger which lights and what
    action to perform (`toggle` or `cycle`). For `cycle`, `cycles` is a list of
    lists, each inner list providing brightness values for the corresponding
    lights array.
- The script ignores actions when target entities were changed less than
    `IGNORE_DELAY_MS` (default 500ms) before the invocation.

The script exposes `python_script.rc_lights` expecting `data.code` with
the remote code.

Example of automation:

```yaml
alias: RC Event
description: ""
triggers:
  - trigger: event
    event_type: esphome.rc_switch_received
conditions: []
actions:
  - action: python_script.rc_lights
    data:
      code: "{{ trigger.event.data.code }}"
mode: single
```

to be published in esphome with
```yaml
remote_receiver:
  [...]
  on_rc_switch:
    - homeassistant.event:
        event: esphome.rc_switch_received
        data:
          device_id: 'nodemcu'
          code: !lambda 'return x.code;'
          protocol: !lambda 'return x.protocol;'    
```

"""

# Modify configuration here
config = {
    "lights": {
        "chambre1": "light.controller_dimmable_5d0c78",
        "chambre2": "light.controller_dimmable_61eabc",
        "salon": "light.controller_dimmable_437607",
    },    
    "remotes": {
        # Chambre
        # Bouton Chambre
        11971761: "chambre_droit",
        11971762: "chambre_gauche",  
        # Bouton Bureau 
        13923313: "chambre_droit",
        13923314: "chambre_gauche",
        # Bouton Lit
        7484321: "lit_droit",
        7484322: "lit_gauche",
        7484324: "lit_milieu",
        # Bouton RF rond
        965633: "lit_rf_rond",
        # Salon
        247950: "salon_droit",
        7934417: "salon_droit",
        7934418: "salon_gauche",
    },
    "commands": [
        # Chambre
        {"title": "Toggle chambre", "remotes": ["chambre_droit","lit_milieu"], "lights": ["chambre1","chambre2"], "command": "toggle"},
        {"title": "Cycle jour", "remotes": ["chambre_gauche","lit_gauche"], "lights": ["chambre1","chambre2"], "command": "cycle", "cycles": [[20,100],[50,255],[255,255]]},
        {"title": "Cycle nuit", "remotes": ["lit_droit"], "lights": ["chambre1","chambre2"], "command": "cycle", "cycles": [[10,10],[0,0],[1,1],[20,20]]},
        # Salon
        {"title": "Toggle salon", "remotes": ["salon_droit"], "lights": ["salon"], "command": "toggle"},
        {"title": "Cycle salon", "remotes": ["salon_gauche"], "lights": ["salon"], "command": "cycle", "cycles": [[255],[150],[50]]},
    ],
}

IGNORE_DELAY_MS = 300

def convert_light(light):
    return config.get("lights",{}).get(light, light)

def convert_remote(remote):
    return config.get("remotes",{}).get(remote, remote)

def hass_service(hass, domain, service, service_data):
    logger.debug(f"rc_lights - hass_service {domain} {service} {service_data}")
    try:
        hass.services.call(domain, service, service_data, False)
    except TypeError:
        hass.services.call(domain, service, service_data)

def command_toggle(entities, states, command):
    any_on = any(s and s.state == "on" for s in states)
    for ent in entities:
        if any_on:
            logger.info(f"rc_lights: toggle off {ent}")
            hass_service(hass, "light", "turn_off", {"entity_id": ent})
        else:
            logger.info(f"rc_lights: toggle on {ent}")
            hass_service(hass, "light", "turn_on", {"entity_id": ent})

def command_cycle(entities, states, command):
    cycles = command.get("cycles", [])
    
    # Try to get current cycle
    logger.debug(f"rc_lights: states {states}")
    cur_state = [s.attributes.get("brightness") or 0 for s in states]
    try:
        cur_index = cycles.index(cur_state)
    except ValueError:
        cur_index = -1

    # Apply next index
    target_index = cur_index + 1 if cur_index < (len(cycles) - 1) else 0
    target_cycle = cycles[target_index]

    # Ensure target_cycle have enough values
    if len(target_cycle) < len(entities):
        if len(target_cycle) == 0:
            target_cycle = [0]
        target_cycle = [ target_cycle[i] if i < len(target_cycle) else target_cycle[0] for i, e in enumerate(entities)]
    
    # Apply cycle values
    logger.info(f"rc_lights: cycle {entities} to {target_cycle}")
    for i, ent in enumerate(entities):
        hass_service(hass, "light", "turn_on", {
            "entity_id": ent, 
            "brightness": target_cycle[i]
        })


def run_command(command):
    # Get lights entities
    lights = [convert_light(l) for l in command.get("lights", [])]

    states = [hass.states.get(l) for l in lights]

    # Ignore if updated too recently (last_changed for status, last_updated for attributes)
    now = dt_util.utcnow()
    recent = any(s and s.last_updated and ((now - s.last_updated).microseconds < (IGNORE_DELAY_MS * 1000)) for s in states)
    if recent:
        logger.info(f"rc_lights: skipping to recent command {command}")
        return

    cmd = command.get("command","")
    if cmd == "toggle":
        command_toggle(lights, states, command)
    elif cmd == "cycle":
        command_cycle(lights, states, command)
    else:
        logger.warning(f"rc_lights: unknown command {cmd}")


def handle_rc(rc, hass):
    # Get remote alias
    remote_alias = convert_remote(rc)
    # Filter commands matching the remote
    commands = [c for c in config.get("commands", [])  if c.get("remotes", []) and ((remote_alias in c.get("remotes", [])) or (rc in c.get("remotes", [])))]

    # Apply commands
    if len(commands) > 0:    
        logger.debug(f"rc_lights: process remote {rc}")
        for command in commands:
            run_command(command)
    else:
        logger.warning(f"rc_lights: no matching command found for remote {rc}")



def ha_script(data, hass):
    """Entry point for Home Assistant python_scripts.

    Expects `data['code']` containing the RC code string. Logs a warning when missing.
    """
    rc = data.get("code") or data.get("rc")
    if not rc:
        logger.warning("rc2magichome: no 'code' provided in data")
        return
    
    handle_rc(rc, hass)

ha_script(data, hass)