
let maddress = []
let mselection = {}
let _nodes

let visnode = new vis.DataSet([])
let  visedge = new vis.DataSet([])
var network

/* init function */
function run() {
    let container = document.getElementById("nodes_container")
    var missionControlWS = new WebSocket("ws://" + window.location.host)
    missionControlWS.onmessage = function (event) {
        _nodes = JSON.parse(event.data)
        if(_nodes.Type && _nodes.Type == "MnmsData") {
            document.getElementById("workspacename-bar").innerHTML = _nodes.Workspace;
            let sw = document.getElementById("switch-info")
            sw.innerHTML = "<i class=\"fas fa-network-wired\"></i> Switches (" + _nodes.OkSwitches + "/" + _nodes.Switches.length + ")";
            if(_nodes.OkSwitches != _nodes.Switches.length)  sw.classList.add("warn")
            else sw.classList.remove("warn")

            setTimeout(() => {missionControlWS.send("data")},4000)
        }
        else {
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
                    buildNodeNav(node,elem)
                }
            }

            setTimeout(() => {missionControlWS.send("nodes")},1500)
            buildGraph(_nodes)
        }
    }
    missionControlWS.onerror =  () => {
        document.getElementById("workspacename-bar").innerHTML  = "<b style='color:red;'>lost connection : socket error</b>"
    }
    missionControlWS.onclose = () => {
        document.getElementById("workspacename-bar").innerHTML  = "<b style='color:red;'>lost connection : socket closed</b>"
    }
    initGraph()
}


/* Selection manipulation */
let lastSelected = null;

var selectNew = (newSelected,node) => {
    maddress = []

    let elem = document.getElementById(lastSelected)
    if(elem) elem.classList.remove("selected")
    elem = document.getElementById(newSelected)
    if(elem) elem.classList.add("selected")
    lastSelected = newSelected;

    console.log(elem)

    let prim = document.getElementById("prim-selection")
    let sec = document.getElementById("prim-selection-sec")
    prim.innerHTML = node.Name;
    prim.className = "prim-on"
    if(mselection.Type == "stream") {
        sec.innerHTML = mselection.Name.split("._")[0];
        sec.className = "prim-on-sec"
        sec.onclick = () => {
            sec.className = "prim-off"
            maddress = []
            mselection = {} 
            makeDeviceInfo(document.getElementById("node-" + node.Name))
        }
    }
    else {
        sec.className = "prim-off"
    }

    prim.onclick = () => {
        prim.className = "prim-off"
        sec.className = "prim-off"

        maddress = []
        mselection = {} 
        win = document.getElementById("win").innerHTML = ""

        let elem = document.getElementById(lastSelected)
        if(elem) elem.classList.remove("selected")
        
    }
}

var getSDPdata = (SDP) => {

    let Out = {
        srcIP : [],  
        dstIP : [], 
        Name : "none", 
        channel : 0, 
        codec : "none",
        sr : 0, 
        dstPort : [], 
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
            if(M.port) Out.dstPort[m_index] = M.port
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


/* Left window fillers */
var makeStreamInfo = (elem,streamname) => {


    mselection.nodeIP = elem._data.node.IP
    mselection.Type = "stream"
    mselection.Name = streamname
    selectNew("node-service-div-" + streamname,elem._data.node)
    
    let win = document.getElementById("win")
    win.innerHTML = ""
    let SDP = elem._data.node.Services[streamname].SDP
    if(!SDP) {
        checkElem(win,"","div","win-sdp-error","still trying to get SDP...")
        buildGraph(_nodes)
        return
    }
    if(SDP.error) {
        checkElem(win,"","div","win-sdp-error","could not get sdp<br>Error " + SDP.error)
        buildGraph(_nodes)
        return
    }
    let Out = getSDPdata(SDP)

    checkElem(win,"","div","win-sdp-name",Out.Name)

    for(let o in Out.dstIP) {
            let ip_dst = Out.dstIP[o].split("/")[0]
            let ttl = Out.dstIP[o].split("/")[1]
            maddress.push(ip_dst)
            checkElem(win,"","div","win-sdp-connection",Out.srcIP[o] + " <br> " + ip_dst + "<br>port:" + Out.dstPort[o] + " /  ttl:" + ttl)
    }
    checkElem(win,"","div","win-sdp-format",Out.channel + " ch at " + Out.sr + "Hz " + Out.codec + " <br> " + Out.packetTime + "ms per frame<br>(" + Math.ceil(Out.packetTime*Out.sr/1000) + " samples)")
    checkElem(win,"","div","win-ptp-format","<b>PTP master (" + Out.PTPdom + ")</b><br>" + Out.PTPid)
    if(Out.aes67) checkElem(win,"","div","win-aes67","AES67")
    if(Out.dash7) checkElem(win,"","div","win-dash7","SMPTE2022-7")
    buildGraph(_nodes)
}

var makeDeviceInfo = (elem) => {
    mselection = {}
    let node = elem._data.node
    selectNew("node-unit-" + node.Name,elem._data.node)
    
    let win = document.getElementById("win")
    win.innerHTML = ""
    mselection.nodeIP = node.IP

    console.log(node)

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
    let streams = checkElem(win,"strsub" ,"div","streams","")
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
    if(node.Multicast) {
        checkElem(win,"multisub" ,"div","streams","Multicast : " + node.Multicast)
    }  
    if(node.Ports) {
        let subcontainer = checkElem(win,"portssub" ,"div","services","")
        checkElem(subcontainer,"","div","switch_port_win_text","Port - I/O Mbps - (multi)")
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
            let port = checkElem(subcontainer,"","div","switch-port-container","")
            let mport = checkElem(port,"","span","switch_port_win port",p.Name)
            console.log(p.IGMP.ForwardAll)
            if(classP == "dc") {
                let text = checkElem(port,"","span","switch_port_win_text port","not connected")
                text.classList.add(classP)
            }
            else if(classP == "off" ) {
                let text = checkElem(port,"","span","switch_port_win_text port","port deactivated")
                text.classList.add(classP)
            }
            else {
                let inp = checkElem(port,"","span","switch_port_win_bw port",(p.In) + "" )
                inp.classList.add(classP)
                checkElem(port,"","span","switch_port_win_text","/")
                let outp = checkElem(port,"","span","switch_port_win_bw port",(p.Out) + "")
                outp.classList.add(classP)

                let multi 
                if(p.IGMP.ForwardAll == "Yes") {
                    multi = checkElem(port,"","span","win-multi","(all)")
                }
                else {
                    nulti = checkElem(port,"","span","win-multi","(" + Object.keys(p.IGMP.Groups).length + ")")
                }
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

var buildNodeNav = (node,elem) => {
    let flex_id = 1000000;
    if(elem._data.node && _.isEqual(elem._data.node,node))
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
                flex_id -= 1;
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
                flex_id -= 10;
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
            flex_id -= 100;
            let classP = ""
            if(p.AdminState == "Up") {
                if(p.Speed > 0) {
                    if(p.In/p.Speed < 0.5 && p.Out/p.Speed < 0.5) {
                        flex_id -= 100;
                        classP += "ok"
                    }
                    else {
                        flex_id -= 1000;
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
    elem.style.order = flex_id
}


/* Graph handling */
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
                newNodes.push({id: i , label: nodes[i].Name.split(".")[0], widthConstraint : { minimum : 350, maximum : 350}, color: {border: bcolor_sw? bcolor_sw : colorOfType(nodes[i].Type,!isRouterForStream), background: colorOfType(nodes[i].Type,true)}, shape: "box", font: { color: "#ffffff"}})                
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