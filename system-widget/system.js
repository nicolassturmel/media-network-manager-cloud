const {ipcRenderer} = require('electron')

// Async message handler
ipcRenderer.on('data', (event, arg) => {
   console.log(arg)
   document.getElementById("status").innerHTML = arg
})

function startSys() {
   console.log("tada")

   let args = {
      id: "bouhoujhpi",
      key: document.getElementById("sysKey").value,
      missioncontrol: null
   }
   ipcRenderer.send('start', JSON.stringify(args))
   document.getElementById("status").innerHTML = Date.now()
} 