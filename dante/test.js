const dante = require("./index.js")
var last = 0

var t = () => {
    if(Date.now() - last > 1500) {
        last = Date.now()
        dante("192.168.1.149").then((streams) => console.log(streams))
        setTimeout(t, 2000)
    }
    else
    console.log(Date.now(),last,Date.now()-last,Number(Date.now - last) > 1500)
}

t()
t()
t()