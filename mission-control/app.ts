var mdns = require('multicast-dns')()


mdns.on('response', (response) => {
    handleResponse(response)
})


mdns.on('query', (query) => {
    //console.log(query)
})

let Host : object = {};
let Services : object = {}


function handleResponse(response) {
    for(let k of response.answers){
        handleItem(k)
    }
    for(let k of response.additionals){
        handleItem(k)
    }

    function handleItem(k) {
        if(k.type == "SRV")
        {
            //console.log(k)
            if(Host[k.data.target]) {
                let subs = [];
                if(Services[k.name])
                    subs = Services[k.name]
                Host[k.data.target].Services[k.name] = {
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
            if(!Host[k.name]) {
                Host[k.name] = {
                    IP: k.data,
                    Services: {}
                }
            }   
        }
        console.log(Host)
    }
}

mdns.query({
    questions:[{
      name: 'valhalla.local',
      type: 'A'
    }]
  })