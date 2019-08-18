
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
                    elem.onclick = () => { document.getElementById("win").innerHTML = JSON.stringify(elem._data.node) }
                }
                //console.log(node)
                buildElem(node,elem)
            }
        }
        buildGraph(nodes)
        setTimeout(() => {missionControlWS.send("git it to me")},1500)
    }
    initGraph()
}

let lastSelected = null;

var selectNew = (newSelected) => {
    let elem = document.getElementById(lastSelected)
    if(elem) elem.classList.remove("selected")
    elem = document.getElementById(newSelected)
    if(elem) elem.classList.add("selected")
    lastSelected = newSelected;
}

var makeStreamInfo = (elem,streamname) => {

    selectNew("node-service-div-" + streamname)

    let srcIP = "X.X.X.X",  
    dstIP = "X.X.X.X", 
    Name = "none", 
    channel = 0, 
    codec = "none",
    sr = 0, 
    dstPort = 0, 
    PTPid = null, 
    PTPdom = null,
    packetTime = 0, 
    avp_audio = false,
    groups = {}
    
    let win = document.getElementById("win")
    win.innerHTML = ""
    let SDP = elem._data.node.Services[streamname].SDP
    if(!SDP) {
        checkElem(win,"","div","win-sdp-error","still trying to get SDP...")
        return
    }
    console.log(SDP)
    if(SDP.error) {
        checkElem(win,"","div","win-sdp-error","could not get sdp<br>Error " + SDP.error)
        return
    }
    if(SDP.connection && SDP.connection.ip) dstIP = SDP.connection.ip
    if(SDP.name) Name = SDP.name


    checkElem(win,"","div","win-sdp-name",Name)


    if(SDP.origin && SDP.origin.address) srcIP = SDP.origin.address
    if(SDP.groups) {
        for(let g of SDP.groups) {
            if(g.type == "DUP") {
                let ar = g.mids.split(" ")
                for(let fl of ar) {
                    groups[fl] = false;
                }
            }
        }
    }
    
    if(SDP.media && SDP.media.length > 0) {
        for(let M of SDP.media) {
            if(M.mid && groups[M.mid] === false) groups[M.mid] = true;
            if(M.connection && M.connection.ip) dstIP = M.connection.ip
            if(M.port) dstPort = M.port
            let pay = M.payloads
            if(M.ptime) packetTime=M.ptime
            if(M.protocol && M.protocol == "RTP/AVP" && M.type && M.type == "audio") avp_audio = true
            if(M.rtp && M.rtp.length > 0) {
                let x = M.rtp.filter(k => k.payload == pay)
                if(x.length > 0) {
                    sr = x[0].rate
                    channel = x[0].encoding
                    codec = x[0].codec
                }
            }
            if(M.sourceFilter) srcIP = M.sourceFilter.srcList
            if(M.invalid) {
                let ts_ref = M.invalid.filter(k => k.value.startsWith("ts-refclk"))
                if(ts_ref.length > 0) {
                    PTPid = ts_ref[0].value.split(":")[2]
                    PTPdom = ts_ref[0].value.split(":")[3]
                }
                ts_ref = M.invalid.filter(k => k.value.startsWith("framecount"))
                if(ts_ref.length > 0) packetTime = (ts_ref[0].value.split(":")[1]*1000/sr + "").substr(0,4)
            }

    let ip_dst = dstIP.split("/")[0]
    let ttl = dstIP.split("/")[1]
    checkElem(win,"","div","win-sdp-connection",srcIP + " <br> " + ip_dst + "<br>port:" + dstPort + " /  ttl:" + ttl)
        }
    }
    if(SDP.invalid) {
        let ts_ref = SDP.invalid.filter(k => k.value.startsWith("ts-refclk"))
        if(ts_ref.length > 0) {
            PTPid = ts_ref[0].value.split(":")[2]
            PTPdom = ts_ref[0].value.split(":")[3]
        }
    }
    checkElem(win,"","div","win-sdp-format",channel + " ch at " + sr + "Hz " + codec + " <br> " + packetTime + "ms per frame<br>(" + Math.ceil(packetTime*sr/1000) + " samples)")
    checkElem(win,"","div","win-ptp-format","<b>PTP master (" + PTPdom + ")</b><br>" + PTPid)
    let dash7 = 4;
    Object.keys(groups).forEach((key) => {
        dash7 = dash7 && groups[key]
    })
    if(avp_audio && PTPid && channel <= 8) checkElem(win,"","div","win-aes67","AES67")
    if(dash7 && dash7 != 4) checkElem(win,"","div","win-dash7","SMPTE2022-7")
}

var checkElem = (root,id,domtype,classElem,innerHTML) => {

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
            elem.id = id
        if(classElem.length > 0)
            elem.className = classElem;
        root.appendChild(elem)
    }

    if(elem.innerHTML != innerHTML && innerHTML.length > 0) elem.innerHTML = innerHTML
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
                checkElem(subcontainer,"node-service-icon-" + key,"i","fas fa-link","")
                checkElem(subcontainer,"node-service-a-" + key,{type: "a", href: "http://" + node.IP + ":" + node.Services[key].port},"http",name)
            }
            else if(key.includes("_telnet")) {
                let subcontainer = checkElem(services,"node-service-div-" + key,"div","","")
                checkElem(subcontainer,"node-service-icon-" + key,"i","fas fa-tty","")
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
                checkElem(subcontainer,"node-service-icon-" + key,"i","fas fa-play-circle","")
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