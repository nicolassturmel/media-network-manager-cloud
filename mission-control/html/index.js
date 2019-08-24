
let selectedElem = null;
let maddress = []
let mselection = {}
let _nodes

let visnode = new vis.DataSet([])
let  visedge = new vis.DataSet([])
var network

function run() {
    let container = document.getElementById("nodes_container")
    var missionControlWS = new WebSocket("ws://" + window.location.host)
    missionControlWS.onmessage = function (event) {
        _nodes = JSON.parse(event.data)
        for(let node of _nodes) {
            if(node.Type != "null" && node.Name) {
                let Name = node.Name
                let elem = document.getElementById("node-" + Name)
                if(elem == undefined) {
                    elem = document.createElement("li")
                    elem._data = {}
                    elem.id = "node-" + Name
                    container.appendChild(elem)
                    elem.onclick = () => { makeDeviceInfo(elem) }
                }
                //console.log(node)
                buildElem(node,elem)
            }
        }
        buildGraph(_nodes)
        setTimeout(() => {missionControlWS.send("git it to me")},1500)
    }
    initGraph()
}

let lastSelected = null;

var selectNew = (newSelected) => {
    maddress = []
    mselection = {}
    let elem = document.getElementById(lastSelected)
    if(elem) elem.classList.remove("selected")
    elem = document.getElementById(newSelected)
    if(elem) elem.classList.add("selected")
    lastSelected = newSelected;
}

var getSDPdata = (SDP) => {

    let Out = {
        srcIP : [],  
        dstIP : [], 
        Name : "none", 
        channel : 0, 
        codec : "none",
        sr : 0, 
        dstPort : 0, 
        PTPid : null, 
        PTPdom : null,
        packetTime : 0, 
        avp_audio : false,
        groups : {},
        dash7: false,
        aes67: true
    }


    if(SDP.connection && SDP.connection.ip) Out.dstIP[0] = SDP.connection.ip
    if(SDP.name) Out.Name = SDP.name
    if(SDP.origin && SDP.origin.address) Out.srcIP[0] = SDP.origin.address
    if(SDP.groups) {
        for(let g of SDP.groups) {
            if(g.type == "DUP") {
                let ar = g.mids.split(" ")
                for(let fl of ar) {
                    Out.groups[fl] = false;
                }
            }
        }
    }
    let m_index = 0;
    if(SDP.media && SDP.media.length > 0) {
        for(let M of SDP.media) {
            if(M.mid && Out.groups[M.mid] === false) Out.groups[M.mid] = true;
            if(M.connection && M.connection.ip) Out.dstIP[m_index] = M.connection.ip
            if(M.port) Out.dstPort = M.port
            let pay = M.payloads
            if(M.ptime) Out.packetTime = M.ptime
            if(M.protocol && M.protocol == "RTP/AVP" && M.type && M.type == "audio") Out.avp_audio = true
            if(M.rtp && M.rtp.length > 0) {
                let x = M.rtp.filter(k => k.payload == pay)
                if(x.length > 0) {
                    Out.sr = x[0].rate
                    Out.channel = x[0].encoding
                    Out.codec = x[0].codec
                }
            }
            if(M.sourceFilter) Out.srcIP[m_index] = M.sourceFilter.srcList
            if(M.invalid) {
                let ts_ref = M.invalid.filter(k => k.value.startsWith("ts-refclk"))
                if(ts_ref.length > 0) {
                    Out.PTPid = ts_ref[0].value.split(":")[2]
                    Out.PTPdom = ts_ref[0].value.split(":")[3]
                }
                let frcount = M.invalid.filter(k => k.value.startsWith("framecount"))
                if(frcount.length > 0) Out.packetTime = (frcount[0].value.split(":")[1]*1000/Out.sr + "").substr(0,4)
            }
            //let ip_dst = Out.dstIP.split("/")[0]
            //let ttl = Out.dstIP.split("/")[1]
            
            m_index++   
        }
    }
    if(SDP.invalid) {
        let ts_ref = SDP.invalid.filter(k => k.value.startsWith("ts-refclk"))
        if(ts_ref.length > 0) {
            Out.PTPid = ts_ref[0].value.split(":")[2]
            Out.PTPdom = ts_ref[0].value.split(":")[3]
        }
    }
    let dash7 = 4;
    Object.keys(Out.groups).forEach((key) => {
        dash7 = dash7 && Out.groups[key]
    })
    if(Out.avp_audio && Out.PTPid && Out.channel <= 8) Out.aes67 = true
    if(dash7 && dash7 != 4) Out.dash7 = true
    return Out
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
    mselection.nodeIP = elem._data.node.IP
    if(!SDP) {
        checkElem(win,"","div","win-sdp-error","still trying to get SDP...")
        buildGraph(_nodes)
        return
    }
    console.log(SDP)
    if(SDP.error) {
        checkElem(win,"","div","win-sdp-error","could not get sdp<br>Error " + SDP.error)
        buildGraph(_nodes)
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
            maddress.push(ip_dst)
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
    buildGraph(_nodes)
}

var makeDeviceInfo = (elem) => {
    let node = elem._data.node
    selectNew("node-unit-" + node.Name)
    
    let win = document.getElementById("win")
    win.innerHTML = ""
    mselection.nodeIP = node.IP

    buildGraph(_nodes)
    checkElem(win,"","div","win-device-name",node.Name)
    let ips = checkElem(win,"","div","win-device-ips","")
    checkElem(ips,"","div","",node.IP)
    for(let i of node.OtherIPs) {
        checkElem(ips,"","div","",i)
    }
    let services = checkElem(win,"","div","services","")
    if(node.Services) {
        Object.keys(node.Services).forEach((key) => {
            let name = key.split("._")[0]
            if(key.includes("_http._tcp")) {
                let subcontainer = checkElem(services,"","div","","")
                checkElem(subcontainer,"","i","fas fa-link","")
                checkElem(subcontainer,"",{type: "a", href: "http://" + node.IP + ":" + node.Services[key].port},"http",name)
            }
            else if(key.includes("_telnet")) {
                let subcontainer = checkElem(services,"" + key,"div","","")
                checkElem(subcontainer,"" ,"i","fas fa-tty","")
                checkElem(subcontainer,"","span","",name)
            }
        })
    }
    let streams = checkElem(win,"".Name,"div","streams","")
    if(node.Services) {
        Object.keys(node.Services).forEach((key) => {
            let name = key.split("._")[0]
            if(key.includes("_rtsp._tcp")) {
                let subcontainer = checkElem(streams,"","div","","")
                checkElem(subcontainer,"","i","fas fa-play-circle","")
                checkElem(subcontainer,"","span","",name)
                let SDPinfo = checkElem(subcontainer,"","div","mini-stream-info","")
                if(node.Services[key].SDP && !node.Services[key].SDP.error) {
                    let info = getSDPdata(node.Services[key].SDP)
                    for(let add of info.dstIP) {
                        checkElem(SDPinfo,"","div","",add)
                    }
                    checkElem(SDPinfo,"","div","",info.sr + "/" + info.channel + "/" + info.codec)
                    if(info.aes67) checkElem(SDPinfo,"","div","win-aes67","AES67")
                    if(info.dash7) checkElem(SDPinfo,"","div","win-dash7","SMPTE2022-7")
                    subcontainer.onclick = (e) => {
                        makeStreamInfo(elem,key)
                        e.stopPropagation();
                    }
                }
                else {
                    checkElem(SDPinfo,"","div","","SDP not available")
                }
            }
        })
    }
    if(node.Ports) {
        let subcontainer = checkElem(win,"".Name,"div","ports-win","")
        for(let p of node.Ports) {
            let classP = ""
            if(p.AdminState == "Up") {
                if(p.Speed > 0) {
                    if(p.In/p.Speed < 0.5 && p.Out/p.Speed < 0.5) {
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
            let port = checkElem(subcontainer,"","div","","")
            let mport = checkElem(port,"","span","switch_port_win port",p.Name)
            if(classP == "dc") {
                let text = checkElem(port,"","span","switch_port_win_text port","not connected")
                text.classList.add(classP)
            }
            else if(classP == "off" ) {
                let text = checkElem(port,"","span","switch_port_win_text port","port deactivated")
                text.classList.add(classP)
            }
            else {
                checkElem(port,"","span","switch_port_win_text","In")
                let inp = checkElem(port,"","span","switch_port_win_bw port",parseInt(p.In) + "" )
                inp.classList.add(classP)
                checkElem(port,"","span","switch_port_win_text","Out")
                let outp = checkElem(port,"","span","switch_port_win_bw port",parseInt(p.Out) + "")
                outp.classList.add(classP)
            }
            mport.classList.add(classP)
        }
    }

    
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
                    elem.target = id
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

var buildElem = (node,elem) => {
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
            if(name.length >= 20) {
                name = name.substr(0,11) + "..." + name.substr(-5)
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
            let port = checkElem(subcontainer,"node-port-" + p.Name + ":" + node.Name,"div","switch_port port",p.Name)
            port.classList.remove("off")
            port.classList.remove("warn")
            port.classList.remove("dc")
            port.classList.remove("off")
            port.classList.add(classP)
        }
    }
}

function colorOfType(type,highlight) {
    if(!highlight) return "#ff00ff"
    switch(type) {
        case "switch":
            return "#007777"
    }
    return "#0077ff";
}


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
                let isRouterForStream = false;
                for(let p of nodes[i].Ports) {
                    let color = "#0077bb"
                    let n = nodes.findIndex(k => k.IP == p.Neighbour)
                    if(n > 0) {
                        for(let add of maddress) {
                            if(p.IGMP.Groups[add] == true) {
                                color = "#ff00ff"
                                isRouterForStream = true;
                            }
                        }
                        let bcolor = color;
                        if(mselection.nodeIP && mselection.nodeIP == nodes[n].IP)  bcolor = "#00ffff"
                        if(nodes[n].Type != "switch") newNodes.push({id: n , label: nodes[n].Name.split(".")[0], borderWidth: 2, color: {border: bcolor, background: colorOfType(nodes[n].Type,color == "#0077bb")}, font: { color: "#00ffff"}})
                        newEdges.push({id: i + "_" + p.Name, from: i, to: n, label: "port " + p.Name, color: {color : color}, font: { strokeWidth: 0, color: "white"}})
                    }
                }
                let bcolor_sw = null;
                if(mselection.nodeIP && mselection.nodeIP == nodes[i].IP)  bcolor_sw = "#00ffff"
                newNodes.push({id: i , label: nodes[i].Name.split(".")[0], widthConstraint : { minimum : 550, maximum : 550}, color: {border: bcolor_sw? bcolor_sw : colorOfType(nodes[i].Type,!isRouterForStream), background: colorOfType(nodes[i].Type,true)}, shape: "box", font: { color: "#ffffff"}})                
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
    network.fit()
}