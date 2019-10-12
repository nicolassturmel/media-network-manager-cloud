// Modules to control application life and create native browser window
const {app, BrowserWindow} = require('electron')
const path = require('path')

const { fork } = require('child_process');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    fullscreen: true,
    show: true
  });

  // and load the index.html of the app.
  mainWindow.loadURL("http://localhost:8888")
  mainWindow.maximize()
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)


// Launching MnMs mission control with mdns on all interfaces

var os = require('os');
var ifaces = os.networkInterfaces();
var interfaces = [];
Object.keys(ifaces).forEach(function (ifname) {
  var alias = 0;

  ifaces[ifname].forEach(function (iface) {
    if ('IPv4' !== iface.family || iface.internal !== false) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return;
    }

    if (alias >= 1) {
      // this single interface has multiple ipv4 addresses
      console.log(ifname + ':' + alias, iface.address);
      interfaces.push(iface.address)
    } else {
      // this interface has only one ipv4 adress
      console.log(ifname, iface.address);
      interfaces.push(iface.address)
    }
    ++alias;
  });
});

var missionControl = require(("media-network-manager-cloud/mission-control"))({
  interfaces: interfaces,
  launch_services: (options) => {
    console.log(options)
    let type = options.Name.split(":")[0]
    let action = options.Name.split(":")[1] 
    if(type == "cisco_switch") {
        if(action == "start") {
          let child_info 
          if(options.Params.Password == "")
            child_info = fork(require.resolve('media-network-manager-cloud/cisco-switch/app.js'),["-u",options.Params.User,"-i",options.Params.IP,"-k",options.Challenge,"-y",options.UID,"-m","localhost" ]
          )
          else
            child_info = fork(require.resolve('media-network-manager-cloud/cisco-switch/app.js'),["-p",options.Params.Password,"-u",options.Params.User,"-i",options.Params.IP,"-k",options.Challenge,"-y",options.UID,"-m","localhost" ]
          )
        child_info.on("error",() => {
                    child_info.kill()
        })
        return child_info
      }
      else if(action == "stop") {
        options.Params.Child.kill()
        return null
      }
    }
    else if(type == "artel_switch") {
      if(action == "start") {
      let child_info
      if(options.Params.Password == "")
        child_info = fork(require.resolve('media-network-manager-cloud/artel-quarra-switch/index.js'),["-u",options.Params.User,"-i",options.Params.IP,"-k",options.Challenge,"-y",options.UID,"-m","localhost" ]
        )
      else
        child_info = fork(require.resolve('media-network-manager-cloud/artel-quarra-switch/index.js'),["-p",options.Params.Password,"-u",options.Params.User,"-i",options.Params.IP,"-k",options.Challenge,"-y",options.UID,"-m","localhost" ]
        )
      child_info.on("error",() => {
                  child_info.kill()
      })
      return child_info
    }
    else if(action == "stop") {
      options.Params.Child.kill()
      return null
    }
  }
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
