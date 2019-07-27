var mdns = require('multicast-dns')()


mdns.on('response', (response) => {
    handleResponse(response)
})


mdns.on('query', (query) => {
    //console.log(query)
})

let Hosts : object = {};
let Services : object = {}


function handleResponse(response) {
    for(let k of response.answers){
        handleItem(k)
    }
    for(let k of response.additionals){
        handleItem(k)
    }

    function handleItem(k) {
        let refresh = false;
        if(k.type == "SRV")
        {
            //console.log(k)
            if(Hosts[k.data.target]) {
                
                let subs = (Hosts[k.data.target].Services[k.name])? Hosts[k.data.target].Services[k.name].subs : [];
                if(Services[k.name]) {
                    refresh = (subs == Services[k.name])? refresh : true;
                    subs = Services[k.name]
                }
                if(!Hosts[k.data.target].Services[k.name])
                    refresh = true;
                Hosts[k.data.target].Services[k.name] = {
                    port: k.data.port,
                    subs : subs
                }
            }
        }
        else if(k.type == "PTR")
        {
            let comps = k.name.split("._");
            if(comps[1] == "sub" ){
                if(!Services[k.data] ){
                    Services[k.data] = []
                }
                if(!Services[k.data].some(p => p === comps[0]) && comps[2] == "http") Services[k.data].push(comps[0])
            } 
            //console.log(k)
        }
        else if(k.type == "A")
        {
            //console.log(k)
            if(!Hosts[k.name]) {
                Hosts[k.name] = {
                    IP: k.data,
                    Services: {}
                }
                refresh = true
            }   
        }
        if(refresh) console.log(Hosts)
    }
}

mdns.query({
    questions:[{
      name: '_http._tcp.local',
      type: 'SRV'
    }]
  })


  function buildServiceHttpLink(obj) {

  }