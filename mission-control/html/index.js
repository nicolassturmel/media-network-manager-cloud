

function run() {
    let container = document.getElementById("nodes_container")
    var missionControlWS = new WebSocket("ws://localhost:8889")
    missionControlWS.onmessage = function (event) {
        let nodes = JSON.parse(event.data)
        console.log(nodes)
        for(let node of nodes) {
            if(node.Type != "null" && node.Name) {
                let Name = node.Name
                let elem = document.getElementById("node-" + Name)
                if(elem == undefined) {
                    elem = document.createElement("li")
                    elem.id = "node-" + Name
                    container.appendChild(elem)
                }
                buildElem(node,elem)
            }
        }
        buildGraph(nodes)
        setTimeout(() => {missionControlWS.send("git it to me")},3000)
    }
}

function checkElem(root,id,domtype,classElem,innerHTML) {

    function isObject(val) {
        if (val === null) { return false;}
        return ( (typeof val === 'function') || (typeof val === 'object') );
    }

    let elem = document.getElementById(id)
    if(!elem) {
        if(isObject(domtype))
        {
            switch(domtype.type) {
                case 'a':
                    elem = document.createElement("a")
                    elem.href = domtype.href
                    break
                default:
                    break;
            }
        }
        else {
            elem = document.createElement(domtype)
        }
        if(id.length > 0)
            elem.id = id
        if(classElem.length > 0)
            elem.className = classElem;
        root.appendChild(elem)
    }
    elem.innerHTML = innerHTML
    return elem;
}

function buildElem(node,elem) {
    let name = node.Name.split(".")[0]
    if(name.length > 21) {
        name = name.substr(0,12) + "..." + name.substr(-5)
    }
    checkElem(elem,"node-name-" + node.Name,"div",node.Type,name)
    checkElem(elem,"node-IP-" + node.Name,"div",node.Type,node.IP)
    let services = checkElem(elem,"node-services-" + node.Name,"div","services","")
    if(node.Services) {
        Object.keys(node.Services).forEach((key) => {
            let name = key.split("._")[0]
            if(name.length > 21) {
                name = name.substr(0,12) + "..." + name.substr(-5)
            }
            if(key.includes("_http._tcp")) {
                let subcontainer = checkElem(services,"node-service-div-" + key,"div","","")
                checkElem(subcontainer,"","i","fas fa-link","")
                checkElem(subcontainer,"node-service-a-" + key,{type: "a", href: "http://" + node.IP + ":" + node.Services[key].port},"http",name)
            }
            else if(key.includes("_telnet")) {
                let subcontainer = checkElem(services,"node-service-div-" + key,"div","","")
                checkElem(subcontainer,"","i","fas fa-tty","")
                checkElem(subcontainer,"node-service-a-" + key,"span","",name)
            }
        })
    }
    let streams = checkElem(elem,"node-streams-" + node.Name,"div","streams","")
    if(node.Services) {
        Object.keys(node.Services).forEach((key) => {
            let name = key.split("._")[0]
            if(name.length > 21) {
                name = name.substr(0,12) + "..." + name.substr(-5)
            }
            if(key.includes("_rtsp._tcp")) {
                let subcontainer = checkElem(streams,"node-service-div-" + key,"div","","")
                checkElem(subcontainer,"","i","fas fa-play-circle","")
                checkElem(subcontainer,"node-stream-a-" + key,"span","",name)
            }
        })
    }
    if(node.Ports) {
        let subcontainer = checkElem(elem,"node-ports-" + node.Name,"div","ports","")
        for(let p of node.Ports) {
            let classP = ""
            if(p.AdminState == "Up") {
                if(p.Speed > 0) {
                    if(p.In/p.Speed < 0.5 && p.Out/p.Speed < 0.5) {
                        console.log(p.Out/p.Speed )
                        classP += "ok"
                    }
                    else {
                        classP += "warn"
                    }
                }
                else {
                    classP += "dc"
                }
            }
            else {
                classP += "off"
            }
            let port = checkElem(subcontainer,"node-port-" + p.Name + ":" + node.Name,"div","switch_port",p.Name)
            port.classList.remove("off")
            port.classList.remove("waarn")
            port.classList.remove("dc")
            port.classList.remove("off")
            port.classList.add(classP)
        }
    }
}

function typeToGroup(type) {
    switch(type) {
        case "switch":
            return 1
    }
    return 0;
}

function buildGraph(nodes) {
    let visnode = [], visedge = [], g = 0;;
    for(let i in nodes) {
        if(nodes[i].Name) {
            visnode.push({id: i , label: nodes[i].Name.split(".")[0], group: typeToGroup(nodes[i].Type)})
            g++;
            if(nodes[i].Type == "switch") {
                for(let p of nodes[i].Ports) {
                    let n = nodes.findIndex(k => k.IP == p.Neighbour)
                    if(n > 0) {
                        visedge.push({from: i, to: n})
                    }
                }
            }
        }
    }
    console.log(visnode, visedge)
    // create a network
  var container = document.getElementById('mynetwork');
  var data = {
    nodes: visnode,
    edges: visedge
  };
  var options = {
      nodes: {
        shape: 'dot',
        size: 30,
        font: {
            size: 32
        },
        borderWidth: 2,
        shadow:true
    },
    "edges": {
      "smooth": {
        "type": "continuous",
        "forceDirection": "none",
        "roundness": 0
      }
    },
    "physics": {
      "barnesHut": {
        "gravitationalConstant": -47540,
        "centralGravity": 2.35,
        "springLength": 140,
        "springConstant": 0.78,
        "damping": 1
      },
      "minVelocity": 0.75
    }
  }
  var network = new vis.Network(container, data, options);
}