
let selectedElem = null;
function run() {
    let container = document.getElementById("nodes_container")
    var missionControlWS = new WebSocket("ws://" + window.location.host)
    missionControlWS.onmessage = function (event) {
        let nodes = JSON.parse(event.data)
        for(let node of nodes) {
            if(node.Type != "null" && node.Name) {
                let Name = node.Name
                let elem = document.getElementById("node-" + Name)
                if(elem == undefined) {
                    elem = document.createElement("li")
                    elem._data = {}
                    elem.id = "node-" + Name
                    container.appendChild(elem)
                    //elem.onclick = () => { document.getElementById("win").innerHTML = JSON.stringify(elem._data.node) }
                }
                buildElem(node,elem)
            }
        }
        buildGraph(nodes)
        setTimeout(() => {missionControlWS.send("git it to me")},1500)
    }
    initGraph()
}

var makeStreamInfo = (elem,streamname) => {
    let win = document.getElementById("win")
    console.log(streamname)
    win.innerHTML = JSON.stringify(elem._data.node.Services[streamname].SDP)
    console.log(elem._data.node.Services[streamname].SDP)
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
    if(elem.innerHTML != innerHTML) elem.innerHTML = innerHTML
    return elem;
}

function buildElem(node,elem) {
    if(elem._data.node && _.isEqual(elem._data.mode,node))
        return
    elem._data.node = node
    let name = node.Name.split(".")[0]
    if(name.length > 21) {
        name = name.substr(0,12) + "..." + name.substr(-5)
    }
    let unit = checkElem(elem,"node-unit-" + node.Name,"div","node-unit","")
    checkElem(unit,"node-name-" + node.Name,"div",node.Type,name)
    checkElem(unit,"node-IP-" + node.Name,"div",node.Type,node.IP)
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
                subcontainer.onclick = (e) => {
                    makeStreamInfo(elem,key)
                    e.stopPropagation();
                }
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
            port.classList.remove("warn")
            port.classList.remove("dc")
            port.classList.remove("off")
            port.classList.add(classP)
        }
    }
}

function colorOfType(type) {
    switch(type) {
        case "switch":
            return "#007777"
    }
    return "#0077ff";
}

let visnode = new vis.DataSet([])
let  visedge = new vis.DataSet([])
var network

var data = {
    nodes: visnode,
    edges: visedge
  };

function initGraph() {
  var options = {
    autoResize: true,
    layout: {
        hierarchical: {
          direction: "UD",
          //sortMethod: "directed",
          nodeSpacing: 400,
          parentCentralization: true,
          blockShifting: false
        }
      },
      interaction: {dragNodes :true},
      physics: {
          enabled: false
      },
      nodes: {
        shape: 'dot',
        size: 30,
        font: {
            size: 32
        },
        borderWidth: 2,
        shadow:false
    },
    "edges": {
      "smooth": {
        "type": "continuous",
        "forceDirection": "none",
        "roundness": 0
      }
    }
  }

    // create a network
    var container = document.getElementById('mynetwork');
   network = new vis.Network(container, data, options);
}

let oldNodes = []
let oldEdges = []

function buildGraph(nodes) {
    let newNodes = [];
    let newEdges = [];
    for(let i in nodes) {
        if(nodes[i].Name) {
            if(nodes[i].Type == "switch") {
                newNodes.push({id: i , label: nodes[i].Name.split(".")[0], widthConstraint : { minimum : 550, maximum : 550}, color: colorOfType(nodes[i].Type), shape: "box", font: { color: "#ffffff"}})
                for(let p of nodes[i].Ports) {
                    let n = nodes.findIndex(k => k.IP == p.Neighbour)
                    if(n > 0) {
                        if(nodes[n].Type != "switch") newNodes.push({id: n , label: nodes[n].Name.split(".")[0], color: colorOfType(nodes[n].Type), font: { color: "#00ffff"}})
                        newEdges.push({id: i + "_" + p.Name, from: i, to: n, label: "port " + p.Name, font: { strokeWidth: 0, color: "#00ffff"}})
                    }
                }
            }
        }
    }
    if(!(_.isEqual(newNodes, oldNodes))) {
        oldNodes = JSON.parse(JSON.stringify(newNodes))
        let tmp = newNodes.slice()
        visnode.update(tmp)
        console.log("new nodes")
    }
    if(!(_.isEqual(newEdges, oldEdges))) {
        console.log(newEdges, oldEdges)
        oldEdges = JSON.parse(JSON.stringify(newEdges))
        let tmp = newEdges.slice()
       visedge.clear()
        visedge.update(tmp)
        console.log("new edges")
    }
}