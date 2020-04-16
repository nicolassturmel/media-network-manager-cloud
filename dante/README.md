# Asks a Dante Device for its list of multicast addresses

* use

Just require the module and call it with the dante device IP. It will return an array of streams info (if, address, port, type, number of channels and channels)

```javascript
const dante = require("./index.js")
dante("192.168.1.149").then((streams) => console.log(streams))
```

* Obviously this will remain beta

The Dante module is not supported by Audinate and base on reverse engineering only. It may fail anytime audinate changes the API. But it is a fun demo, and is actualy usefull !