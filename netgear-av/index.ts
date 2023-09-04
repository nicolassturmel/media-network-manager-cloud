import axios from 'axios';

let SwitchPollTime = 5

let commandLineArgs = require('command-line-args')

import { MnMs_node, boolString, MnMs_node_port } from "../types/types"

import * as https from 'https';

// Désactiver la vérification SSL
let httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Command line arguments
let optionDefinitions = [
    { name: 'ip', alias: 'i', type: String, defaultValue: '192.168.1.107' },
    { name: 'user', alias: 'u', type: String, defaultValue: 'admin' },
    { name: 'password', alias: 'p', type: String, defaultValue: '' },
    { name: 'key', alias: 'k', type: String, defaultValue: 'nokey' },
    { name: 'id', alias: 'y', type: String, defaultValue: undefined },
    { name: "missioncontrol", alias: "m", type: String}
  ]

let options = commandLineArgs(optionDefinitions)
console.log(options)

var client = require('../mnms-client-ws-interface')

client.challenge(options.key)
client.setCallback((data) => {console.log(data)})
client.run(options.missioncontrol)
client.info({
    Info: "Netgear AV switch client",
    ServiceClass: "Switches",
    id: options.id
})

// Connecting to switch

var SwitchData = {
    oldT: 0
};

var OldValue: object = {}
var Switch : MnMs_node = { 
    Name: "Netgear AV",
    Type: "switch", 
    IP: options.ip,
    Schema: 1, 
    Ports: [], 
    Multicast: "off", 
    Neighbour: "",
    Mac: "", 
    id: options.id,
    _Timers: [{
        path: "$",
        time: 10
    }]
};    
var ActionCount = 0;
var ClearTime = 0;
var CountTime = 0;
var NewData

let apiPath = options.ip + ':8443/api/v1'

async function getAccessToken(username: string, password: string) {
    try {
      let response = await axios.post(`https://${apiPath}/login`, {
        login: {
          username,
          password
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        httpsAgent
      });
      let accessToken = response.data.login.token;  // Le nom de la clé peut varier selon l'API
      return accessToken;
    } catch (error) {
      console.error('Erreur lors de l\'obtention du jeton d\'accès:',error);
      return null;
    }
  }
  
  async function getDeviceInfo(token: string) {
    try {
      let headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      let response = await axios.get(`https://${apiPath}/device_info`, { headers, httpsAgent });
      if(response.data.resp.status != 'success') {
        console.log("error when getting device info")
        return
      }
      Switch.Name=response.data.deviceInfo.model + ' ' + response.data.serialNumber
      Switch.Mac = response.data.deviceInfo.macAddr
      let cpu = response.data.deviceInfo.cpuUsage
      Switch.System = {
        CPUTemps: response.data.deviceInfo.temperatureSensors.sensorTemp,
        CPU5s: cpu,
        CPU1min: cpu,
        CPU5min: cpu,
        MemBusy: response.data.deviceInfo.memoryUsage
      }
      Switch.IP = options.ip
    } catch (error) {
      console.error('Erreur lors de la récupération de la table des adresses MAC:',error);
    }
  }

  async function getPorts(token: string) { // sw_portstats?portid="ALL"
    try {
      let headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      let port = 1;
      let rstatus = false
      do {
        let response = await axios.get(`https://${apiPath}/sw_portstats?portid=${port}`, { headers, httpsAgent });

        port++
        rstatus = (response.data.resp && (response.data.resp.status == "success"))
        console.log(rstatus)
        if(rstatus) {
            
            // console.log(response.data.switchStatsPort)
        }
      }
      while(rstatus)
    } catch (error) {
      console.error('Erreur lors de la récupération de ports',error);
    }
  }

  async function lldp(token: string) {
    try {
      let headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      console.log("fdbs")
      let response = await axios.get(`https://${apiPath}/fdbs`, { headers, httpsAgent });
      console.log("got",response)
    } catch (error) {
      console.error('Erreur lors de la récupération de la table lldp',error);
    }
  }

  async function template(token: string) {
    try {
      let headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      let response = await axios.get(`https://${apiPath}/device_info`, { headers, httpsAgent });
      console.log(response)
    } catch (error) {
      console.error('Erreur lors de la récupération de la table des adresses MAC:',error);
    }
  }

getAccessToken(options.user, options.password).then(async token => {
    if (token) {
      console.log('Jeton d\'accès obtenu:', token);
      // Vous pouvez maintenant utiliser ce jeton pour les requêtes suivantes
      
        await getDeviceInfo(token);
        await getPorts(token)
        await lldp(token)
    }
  });