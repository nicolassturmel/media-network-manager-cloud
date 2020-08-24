# Advanced use of MNMS

When you really like or use MNMS, those features might help you get further.

## Static devices (declaring devices)

in the ```mission-control``` subdir you can create pseudo devices that will help MNMS get back on its feet. For that, create ```devices.json``` which  contains an array of objects. Those object have three fields:
- Name (mandatory): string
- IPs (optionnal): array of strings (IPs of the device)
- MACs (optionnal): array of strings (MAC address)

For the current version,  at least one IP is needed for the device to be merged with automatic discoveries.

Example:
```json
[
    {
        "Name": "test",
        "IPs":["192.168.67.1"],
        "MACs":["AA:BB:CC:11:22:33","AA:BB:CC:44:22:33"]
    }
]
```


## Multiple VLANs

When using multiple VLANs, the best is for your computer running MNMS to have access to all at L2 (one virtual interface per VLAN). When not possible, MNMS can use the Arp Table (CISCO only for the moment) to detect other devices but will not elaborate on services present on the device.

The typical use case of 2022-7 can be solved by declaring static devices to show MNMS that two Mac Address are linked to the same device.

## Cross VLAN discovery

You can even get further by using multicast VLAN to allow multicast DNS-SD (group 224.0.0.251) to be sent accross VLANs. I still have to test this.

## REST API 

You can access the node data base at:
```<MNMS IP>:8888/nodes```

You can even filter data by using name of fields from the Node Schema. String will be matched, including the element of a an array

```<MNMS IP>:8888/nodes?Name=test&IP=192.168.67.1```