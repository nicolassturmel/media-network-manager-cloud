
let maddress = []
let mselection = {}
let _nodes = []
let _data
let MColors = ["#ff00ff","#ffff00"]

let visnode = new vis.DataSet([])
let visedge = new vis.DataSet([])
var network
var missionControlWS

/* init function */
function run() {
    let switchInfo = document.getElementById("switch-info")
    let ptpInfo = document.getElementById("ptp-info")
    let mdnsInfo = document.getElementById("mdns-info")
    let container = document.getElementById("nodes_container")
    missionControlWS = new WebSocket("ws://" + window.location.host)

    document.getElementById("leftmenu").style.display = "none"

    document.getElementById("menu-btn").onclick = () => {
        document.getElementById("menu-btn").style.display = "none"
        document.getElementById("leftmenu").style.display = "block"
        document.getElementById("port").classList.add("menu-expanded")
        makeSettingsMenu()
    }


    let nodeSearch = document.getElementById("nodeSearchInput")
    nodeSearch.oninput = () => {
        console.log("Search change " + nodeSearch.value)
        for(let n of _nodes) {
            let el = document.getElementById("node-" + n.Name)
            if(!el) continue
            if(n.Name.includes(nodeSearch.value)
                || n.Type.includes(nodeSearch.value)
                || n.IP.includes(nodeSearch.value)
                || n.OtherIPs.some(k => k.includes(nodeSearch.value))
            )
            {
                el.classList.remove("hidden")
            }
            else
            {
                el.classList.add("hidden")   
            }
        }
    }
    document.getElementById("nodeSearchStop").onclick = () => {
        nodeSearch.value = ""
        nodeSearch.oninput()
    }

    var switchMenu = () => {
        console.log(_data)
        let popUp = document.getElementById("popUp-menu") 
        if(popUp) {
            popUp.outerHTML = ""
        }
        else {
            let popUp = checkElem(switchInfo,"popUp-menu","div","popUp-menu","")
            makeSwitchMenu()
        }
    }

    var ptpMenu = () => {
        console.error("PTP")
        let popUp = document.getElementById("popUp-menu") 
        if(popUp) {
            popUp.outerHTML = ""
        }
        else {
            let popUp = checkElem(ptpInfo,"popUp-menu","div","popUp-menu","")
            makePtpMenu()
        }

        mselection.nodeIP = "0.0.0.0"
        mselection.Type = "stream"
        mselection.Name = "multicast registrations"
        selectNew("",{Name:"PTP"})
        maddress.push("224.0.1.129")
        buildGraph(_nodes)
    }

    var makeSwitchMenu = () => {
        let popUp = document.getElementById("popUp-menu") 
        if(popUp) {
            popUp._data = {type : "switch"}
            for(let n of _nodes) {
                if(!_data.Switches.some(k => k.IP == n.IP)) {
                    if(n.Services) Object.keys(n.Services).forEach(key => {
                        if(key.search("_csco-sb") != -1) {
                            let newSw = checkElem(popUp,"popup-switch-" + n.IP,"div","popUp-elem","Add cisco switch at " + n.IP)
                            newSw.onclick = () => {
                                missionControlWS.send(JSON.stringify(
                                    {
                                        Type: "ciscoSG",
                                        IP: n.IP,
                                        User: "cisco",
                                        Password: "cisco"
                                    }
                                ))
                            }
                        }
                    })
                }
            }
            for(let s of _data.Switches) {
                let swClass = "popUp-elem"
                let secs = parseInt(-(s.StartTime - _data.CurrentTime)/1000);
                let secsStr = " started " + parseInt(secs) + "s"
                if(secs > 120)
                    secsStr = " started " + parseInt(secs/60) + "min"
                if(secs > 7200)
                    secsStr = " started " + parseInt(secs/3600) + "hours"
                if(secs < 16) {
                    secsStr = " starting..."
                    swClass += " warn"
                }
                checkElem(popUp,"popup-switch-" + s.IP,"div",swClass,s.Type + ":" + s.IP + secsStr)
            }
        }
    }

    var makePtpMenu = () => {
        let popUp = document.getElementById("popUp-menu") 
        if(popUp) {
            popUp._data = {type : "ptp"}
            let PtPScanners = []
            if(_data.Analysers)
                PtPScanners = _data.Analysers.filter(k => k.Info == "PTP scannner" && k.node)
            if(PtPScanners.length > 0) {
                for(item of PtPScanners) {
                    console.error(item)
                    // V2 subdomains
                    Object.keys(item.node["2"]).forEach(k => {
                        let Mas = checkElem(popUp,"master-" + item.node["2"][k]._masterAddress,"div","","")
                        checkElem(Mas,"master-name" + item.node["2"][k]._masterAddress,"div","",item.node["2"][k]._masterAddress)
                        checkElem(Mas,"master-v2-dom-" + k + "-" + item.node["2"][k]._masterAddress,"div","","Version 2 - Domain " + k + " : master")
                            checkElem(Mas,"error-v2-dom-" + k + "-" + item.node["2"][k]._masterAddress,"div","",item.node["2"][k].message)
                        
                    })
                    Object.keys(item.node["1"]).forEach(k => {
                        let Mas = checkElem(popUp,"master-" + item.node["1"][k]._masterAddress,"div","","")
                        checkElem(Mas,"master-name" + item.node["1"][k]._masterAddress,"div","",item.node["1"][k]._masterAddress)
                        checkElem(Mas,"master-v1-dom-" + k + "-" + item.node["1"][k]._masterAddress,"div","","Version 1 - Domain " + k + " : master")
                            checkElem(Mas,"error-v1-dom-" + k + "-" + item.node["1"][k]._masterAddress,"div","",item.node["1"][k].message)
                    })
                }
                    
            } 
            else checkElem(popUp,"pop-up-ptp","span","","To have more ptp info launch the PTP service with administrator permissions.")
        }
    }

    switchInfo.onclick = switchMenu 
    ptpInfo.onclick = ptpMenu

    missionControlWS.onmessage = function (event) {
        data = JSON.parse(event.data)
        if(data.Type && data.Type == "MnmsData") {
            _data = data
            document.getElementById("workspacename-bar").innerHTML = _data.Workspace;
            let swInfoTxt = checkElem(switchInfo,"switchInfoText","span","switch-info-span",
                "<i class=\"fas fa-network-wired\"></i> Switches (" + _data.OkSwitches + "/" + _data.Switches.length + ")");
            if(_data.OkSwitches != _data.Switches.length)  swInfoTxt.classList.add("warn")
            if(_data.Mdns) checkElem(mdnsInfo,"mdns-info-txt","span","","MDNS (" + _data.Mdns.length + ")")
            else swInfoTxt.classList.remove("warn")
            let popUp = document.getElementById("popUp-menu") 
            if(popUp) {
                if(popUp._data.type == "switch")
                    makeSwitchMenu()
                if(popUp._data.type == "ptp")
                    makePtpMenu()
            }
            setTimeout(() => {missionControlWS.send("data")},4000)
        }
        else {
            // copy UI params
            for(let node of _nodes) {
                let f = data.findIndex(k => k.Name == node.Name)
                if(f >= 0) {
                    data[f].UIParams = node.UIParams
                }
            }
            _nodes = data
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
            selectNew(lastSelected,null)
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

var makeSettingsMenu = () => {

    let menu = document.getElementById("leftmenu");
    menu.innerHTML = ""
    let close = checkElem(menu,"leftMenuClose","div","","<i class=\"far fa-times-circle\"></i>")
    close.onclick = () => {
        document.getElementById("menu-btn").style.display = "block"
        document.getElementById("leftmenu").style.display = "none"
        document.getElementById("port").classList.remove("menu-expanded")
    }

    var clickElem = (X) => {
        if(X.classList.contains("expanded")) {
            X.classList.remove("expanded")
            return false
        }
        else {
            X.classList.add("expanded")
            return true
        }
    }

    var onscreenPopup = (type,params) => {
        if(document.getElementById("popupBox")) return
        let root = document.getElementById("popupSpace");
        let win = document.createElement("div")
        win.id = "popupBox";
        let port = document.getElementById("port")
        port.classList.add("blured")
        /*port.onclick = () => {
            port.classList.remove("blured")
            root.innerHTML = ""
        }*/


        if(type.Name) {
            let a = checkElem(win,"","div","","")
            checkElem(a,"","h2","","Launch " + type.Name.replace("_"," "))
        }

        let fiedls = {};
        Object.keys(params).forEach((k) => {
            if(k == "Type") return
            let a = checkElem(win,"","div","","")
            checkElem(a,"popupField" + k,"span","popup-field",k)
            let f = checkElem(a,"","input","right","")
            fiedls[k] = f
        })


        let a = checkElem(win,"","div","","")
        let cancel = checkElem(a,"","span","popupCancel left","Cancel")
        let ok = checkElem(a,"","span","popupOk right","Ok")
        cancel.onclick = () => {
            port.classList.remove("blured")
            root.innerHTML = ""
        }
        ok.onclick = () => {
            Object.keys(fiedls).forEach((k) => {
                params[k] = fiedls[k].value
            })
            missionControlWS.send(JSON.stringify(params))
            port.classList.remove("blured")
            root.innerHTML = ""
        }

        root.appendChild(win)

        win.addEventListener("keyup", function(event) {
            // Number 13 is the "Enter" key on the keyboard
            if (event.keyCode === 13) {
              // Cancel the default action, if needed
              ok.onclick();
              // Trigger the button element with a click
              document.getElementById("myBtn").click();
            }
          });
    }

    var buildSettingsItem = (root,k,val,previd) => {

        if(val["Type"] && val["Type"] == "ServiceLaunch") {
            if(k == "Type") {
                return
            }
            else {
                let act = checkElem(root,previd + k,"div","settingsValue",k)
                act.onclick = () => { onscreenPopup({Type: val["Type"], Name: k},val[k])}
                return
            }
        }
        else if(val[k] == null || k=="MnmsData")
            return;
        else if(k === "UID" || k == "_id") { return }

        let Id = previd + k
        let elem = checkElem(root,Id,"div","settingsItem"," ")

        if(k === "Ws")
        {
            let act = checkElem(elem,"","span","settingsValue","disconnect and remove")
            act.onclick = () => {

                missionControlWS.send(JSON.stringify({
                    UserAction: "remove_service",
                    UID : val.UID
                }))
                console.log("Closing ??")
                close.onclick()
            }
        }
        else if(k === "Child") {
            if(val[k])
            checkElem(elem,"","span","settingsTitle","pause")
            else
            checkElem(elem,"","span","settingsTitle","remove")
        }
        else if(k === "Type") {
            checkElem(elem,"","span","settingsValue",val[k] + "")
            elem.classList.add("alone")
        }
        else if(Array.isArray(val[k])) {
            let toggle = checkElem(elem,"","span","settingsToggle",k)
            toggle.onclick = () => {
                clickElem(elem)
                for(let l in val[k]) {
                    buildSettingsItem(elem,l,val[k],Id)
                }
            }

            //checkElem(elem,"","div","settingsTitle",k + " : Array")
            
        }
        else if(typeof val[k] === "object") {
            let toggle = checkElem(elem,"","span","settingsToggle",k)
            if(val[k].Name) toggle.innerHTML = val[k].Name

            toggle.onclick = () => {
                clickElem(elem)
                Object.keys(val[k]).forEach(l => buildSettingsItem(elem,l,val[k],Id))
            }
        }
        else {
            let toggle = checkElem(elem,"","span","settingsToggle",k)
            elem.classList.add("expanded")
            toggle.onclick = () => clickElem(elem)
            checkElem(elem,"","div","settingsValue",val[k] + "")
        }
    } 

    Object.keys(_data).forEach((k) => buildSettingsItem(menu,k,_data,"settings"))

    buildSettingsItem(menu,"Nodes",{Nodes : _nodes},"nodes")
}

/* Selection manipulation */
let lastSelected = null;
let lastNode = null;

var selectNew = (newSelected,node) => {
    if(!newSelected) return
    if(!node) node = lastNode
    else {
        lastNode = node
        maddress = []
    }

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
        lastNode = null
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
            if(M.tsRefClocks) {
                for(let clk of M.tsRefClocks) {
                    if(clk.clksrc == "ptp" && clk.clksrcExt) {
                        Out.PTPid = clk.clksrcExt.split(":")[1]
                        Out.PTPdom = clk.clksrcExt.split(":")[2]
                    }
                }
            }
            m_index++   
        }
    }
    if(SDP.tsRefClocks) {
        for(let clk of SDP.tsRefClocks) {
            if(clk.clksrc == "ptp" && clk.clksrcExt) {
                Out.PTPid = clk.clksrcExt.split(":")[1]
                Out.PTPdom = clk.clksrcExt.split(":")[2]
            }
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
            else if(key.includes("netaudio-a")) {
                let contain = checkElem(streams,"","div","","")
                if(node.Services[key].Streams) for(let str of node.Services[key].Streams) {
                    if(str) {
                        let X = checkElem(contain,str.Id,"div","dante_streams"
                        ,str.Id  +": " + str.Type+" - "+str.numChan+"ch <br>=> "+str.Address+"<br>"+((str.Address2)? "<br>=> "+str.Address2: "") +(()=>{let zz="" ;str.Channels.forEach(ch => zz += " " + ch); return zz})())
                        X.onclick = () => {
                            mselection.nodeIP = elem._data.node.IP
                            mselection.Type = "stream"
                            mselection.Name = str.Type + " " + str.Address   
                            selectNew("node-unit-" + node.Name,elem._data.node) 
                            maddress = [ str.Address ]   
                            if(str.Address2)
                                maddress.push(str.Address2)
                            buildGraph(_nodes)               
                        }
                    }
                }
            }
        })
    }
    if(node.Multicast) {
        checkElem(win,"multisub" ,"div","streams","Multicast : " + node.Multicast)
    }  
    if(node.Ports && node.Ports.length > 0) {
        let subcontainer = checkElem(win,"portssub" ,"div","services","")
        let buttons = checkElem(subcontainer,"buttonsSwitch" ,"div","services","")
        let unplugged = checkElem(buttons,"buttonsSwitchUP" ,"span",(!node.UIParams.Ports.showUnplugged)? "button" : "button highlight","D.C.")
        let plugged = checkElem(buttons,"buttonsSwitchP" ,"span",(!node.UIParams.Ports.showPlugged)? "button" : "button highlight","Plugged")
        let off = checkElem(buttons,"buttonsSwitchOff" ,"span",(!node.UIParams.Ports.showOff)? "button" : "button highlight","Off")
        unplugged.onclick = () => { 
            node.UIParams.Ports.showUnplugged = !node.UIParams.Ports.showUnplugged
            console.error("Click")
            makeDeviceInfo(elem)
        }
        plugged.onclick = () => { 
            node.UIParams.Ports.showPlugged = !node.UIParams.Ports.showPlugged
            console.error("Click")
            makeDeviceInfo(elem)
        }
        off.onclick = () => { 
            node.UIParams.Ports.showOff = !node.UIParams.Ports.showOff
            console.error("Click")
            makeDeviceInfo(elem)
        }
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
                    if(!node.UIParams.Ports.showPlugged) continue
                }
                else {
                    classP += "dc"
                    if(!node.UIParams.Ports.showUnplugged) continue
                }
            }
            else {
                classP += "off"
                if(!node.UIParams.Ports.showOff) continue
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
                if(p.IGMP.ForwardAll == "on") {
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
        root.appendChild(elem)
    }

    if(classElem.length > 0 && elem.className != classElem)
        elem.className = classElem;
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
        let numS = 0;
        var buildServices = (key) => {
            numS ++
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
                flex_id -= 1;
                let subcontainer = checkElem(services,"node-service-div-" + key,"div","","")
                checkElem(subcontainer,"node-service-icon-" + key,"i","fas fa-tty","")
                checkElem(subcontainer,"node-service-a-" + key,"span","",name)
            }
            else if(key.includes("_netaudio-arc")) {
                flex_id -= 1;
                let subcontainer = checkElem(services,"node-service-div-" + key,"div","","")
                checkElem(subcontainer,"node-service-icon-" + key,"i","fab fa-dochub","")
                checkElem(subcontainer,"node-service-a-" + key,"span",""," - " + name)
            }
        }
        Object.keys(node.Services).forEach(buildServices)
        if(numS != services.childNodes.length) {
            services.innerHTML = ""
            Object.keys(node.Services).forEach(buildServices)
        }
    }
    let streams = checkElem(elem,"node-streams-" + node.Name,"div","streams","")
    if(node.Services) {
        let sNum = 0;
        let buildStreams = (key) => {
            let name = key.split("._")[0]
            if(name.length >= 20) {
                name = name.substr(0,11) + "..." + name.substr(-5)
            }
            if(key.includes("_rtsp._tcp")) {
                flex_id -= 10;
                sNum ++
                let subcontainer = checkElem(streams,"node-service-div-" + key,"div","","")
                checkElem(subcontainer,"node-service-icon-" + key,"i","fas fa-play-circle","")
                checkElem(subcontainer,"node-stream-a-" + key,"span","",name)
                subcontainer.onclick = (e) => {
                    makeStreamInfo(elem,key)
                    e.stopPropagation();
                }
            }
        }
        Object.keys(node.Services).forEach(buildStreams)
        if(sNum != streams.childNodes.length) {
            streams.innerHTML = ""
            Object.keys(node.Services).forEach(buildStreams)
        }
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
function colorOfType(type,highlight,cannot) {
    if(cannot) return "#777777"
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
          parentCentralization: false,
          edgeMinimization: true,
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
   network.on('click',(e) => {
       console.error(e.nodes)
       if(e.nodes && document.getElementById("node-" + _nodes[e.nodes[0]].Name)) {
            makeDeviceInfo(document.getElementById("node-" + _nodes[e.nodes[0]].Name))
            let Node = document.getElementById("node-" + _nodes[e.nodes[0]].Name)
            let Container = document.getElementById("node_container")
       }
    })
}

let oldNodes = []
let oldEdges = []
let macToFind = []

function buildGraph(nodes) {
    let newNodes = [];
    let newEdges = [];
    for(let i in nodes) {
        if(nodes[i].Name) {
            if(nodes[i].Type == "switch") {
                let isRouterForStream = false;
                for(let p of nodes[i].Ports) {
                    let color = "#0077bb"
                    let n = nodes.findIndex(k => { if(k.Type == "null") return false ; return( k.OtherIPs.some(l => l == p.Neighbour) || k.IP == p.Neighbour) })
                    if(n > 0) {
                        if(nodes[n].Type == "switch") {
                            if(p.IGMP.ForwardAll == "on") {
                                for(let xp of nodes[i].Ports) {
                                    Object.keys(xp.IGMP.Groups).forEach(xadd => {
                                    //    if(!nodes[n].Ports.some(cp => cp.IGMP.Groups[xadd] == true)) {
                                            p.IGMP.Groups[xadd] = true
                                    //    }
                                    })
                                }
                            }
                        }
                        
                        let index = 0;
                        for(let mac of p.ConnectedMacs) {
                            if(mac == macToFind) {
                                //console.error("Found mac " + mac + " in switch " + nodes[i].Name + ":" + p.Name)
                            }
                        }
                        let bcolor = color;
                        let edge_width = 1;
                        for(let add of maddress) {
                            if(p.IGMP.Groups[add] == true) {
                                color = MColors[index]
                                isRouterForStream = true;
                                edge_width = 3
                            }
                            index = (index + 1)%MColors.length
                        }
                        if(mselection.nodeIP && mselection.nodeIP == nodes[n].IP)  {
                            bcolor = "#00ffff"
                        }
                        if(nodes[n].Type != "switch") newNodes.push({id: n , mass:20, label: nodes[n].Name.split(".")[0], borderWidth: 2, color: {border: bcolor, background: colorOfType(nodes[n].Type,color == "#0077bb")}, font: { color: "#00ffff"}})
                        newEdges.push({id: i + "_" + p.Name, from: i, to: n, label: "port " + p.Name, color: {color : color}, width: edge_width, font: { strokeWidth: 0, color: "white"}})
                    }
                }
                let cannot = false;
                let bcolor_sw = null;
                if(maddress.length > 0 && nodes[i].Capabilities && nodes[i].Capabilities.MulticastRoute == "no") cannot = true
                if(mselection.nodeIP && mselection.nodeIP == nodes[i].IP)  bcolor_sw = "#00ffff"
                newNodes.push({id: i , label: nodes[i].Name.split(".")[0], mass: 2000, widthConstraint : { minimum : 350, maximum : 350}, color: {border: bcolor_sw? bcolor_sw : colorOfType(nodes[i].Type,!isRouterForStream), background: colorOfType(nodes[i].Type,true,cannot)}, shape: "box", font: { color: "#ffffff"}})                
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