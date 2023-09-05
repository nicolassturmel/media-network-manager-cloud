
let maddress = []
let mselection = {
    vlan: null
}
let mvlans = [
    1,
    2,
    2022
]
let VlanColor = (v) => {
    let corrlen = (e) => {
        if(e.length < 2) return "0" + e
        return e
    }
    let r = (v%11)*22 
    let g = (v%3)*80 + 80
    let b = (v%7)*35 + 80
    r = r>128 ? 128 : r;
    g = g>255 ? 255 : g;
    b = b>255 ? 255 : b;
    return "#" + corrlen(r.toString(16)) + corrlen(g.toString(16)) + corrlen(b.toString(16))
}

let _nodes = []
let _data
let MColors = ["#ff00ff","#ffff00"]

let visnode = new vis.DataSet([])
let visedge = new vis.DataSet([])
var network
var missionControlWS
var snapErrors = []

/* init function */
function run() {
    let switchInfo = document.getElementById("switch-info")
    let ptpInfo = document.getElementById("ptp-info")
    let mdnsInfo = document.getElementById("mdns-info")
    let container = document.getElementById("nodes_container")
    let overlay = document.getElementById("popupSpace")
    overlay.oncontextmenu = false
    missionControlWS = new WebSocket("ws://" + window.location.host)

    document.getElementById("leftmenu").style.display = "none"

    document.getElementById("menu-btn").onclick = () => {
        document.getElementById("menu-btn").style.display = "none"
        document.getElementById("leftmenu").style.display = "block"
        document.getElementById("port").classList.add("menu-expanded")
        makeSettingsMenu()
    }

    document.getElementById("snapshot-select").onchange = d => missionControlWS.send(JSON.stringify({Type :"Snapshot::select", id: document.getElementById("snapshot-select").value}))
    document.getElementById("snapshot-add").onclick = () => onscreenPopup({Type: "Snapshot::create"},{Type: "Snapshot::create", "Name":"Snap-" + Date.now()})


    let nodeSearch = document.getElementById("nodeSearchInput")
    nodeSearch.oninput = () => {
        console.log("Search change " + nodeSearch.value)
        for(let n of _nodes) {
            let el = document.getElementById("node-" + n.Name)
            if(!el) continue
            if(n.Name.includes(nodeSearch.value)
                || n.Type.includes(nodeSearch.value)
                || n.IP.includes(nodeSearch.value)
                || (n.OtherIPs && n.OtherIPs.some(k => k.includes(nodeSearch.value)))
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
                                onscreenPopup({Type: "cisco_switch", 
                                Name: "cisco_switch",
                                Params: {
                                    IP: n.IP,
                                    User: "cisco",
                                    Password: "cisco"
                                }
                            },_data.Services.cisco_switch)
                                /*missionControlWS.send(JSON.stringify(
                                    {
                                        Type: "ciscoSG",
                                        IP: n.IP,
                                        User: "cisco",
                                        Password: "cisco"
                                    }
                                ))*/
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
                if(s.Timer - _data.CurrentTime < -30000) {
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
            else checkElem(popUp,"pop-up-ptp","span","","PTP scaneer is a work in progress.")
        }
    }

    switchInfo.onclick = switchMenu 
    ptpInfo.onclick = ptpMenu

    let title = false
    missionControlWS.onmessage = function (event) {
        document.getElementById("disconnectMessage").classList.add("hidden")
        data = JSON.parse(event.data)
        if(data.Type && data.Type == "MnmsData") {
            _data = data
            if(document.getElementById("workspacename-bar").innerHTML  != _data.Workspace) {
                document.getElementById("workspacename-bar").innerHTML = _data.Workspace;
            }
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
        else if(data.Type && data.Type == "MnmsSnapshot") {
            console.log("MnmsSnapshot", data)
            if(data.List) {
                let dom = document.getElementById("snapshot-select")
                dom.innerHTML = ""
                data.List.forEach(e => {
                    console.log(e)
                    let o = document.createElement("option")
                    o.value = e.id
                    o.innerHTML = e.Name
                    dom.appendChild(o)
                })
            }
            if(data.Selected) document.getElementById("snapshot-select").value = data.Selected
            if(data.Errors) {
                snapErrors = data.Errors
            }
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
                        elem.className = "node-navigation"
                        container.appendChild(elem)
                        elem.onclick = () => { makeDeviceInfo(elem) }
                    }
                    //console.log(node)
                    buildNodeNav(node,elem)
                }
            }
            document.querySelectorAll("li.node-navigation").forEach(e => {
                if(!_nodes.some(n => n.Name == e.id.split("node-")[1])) {
                    e.outerHTML = ""
                }
            })

            setTimeout(() => {missionControlWS.send("nodes")},2500)
            buildGraph(_nodes)
            if(mselection.Type != "stream") {
               if(lastNode) makeDeviceInfo(document.getElementById("node-" + lastNode.Name),true)
            }
            else
                selectNew(lastSelected,null)
        }
    }
    missionControlWS.onerror =  () => {
        document.getElementById("workspacename-bar").innerHTML  = "<b style='color:red;'>lost connection : socket error</b>"
    }
    missionControlWS.onclose = () => {
        document.getElementById("workspacename-bar").innerHTML  = "<b style='color:red;'>lost connection : socket closed</b>"

        document.getElementById("disconnectMessage").classList.remove("hidden")
        setTimeout(run,2000)
    }
    initGraph()
    selectNew(null,null)
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
        checkElem(a,"","h2","",type.Name.replace("_"," "))
    }

    let fiedls = {};
    Object.keys(params).forEach((k) => {
        if(k == "Type") return
        let a = checkElem(win,"","div","","")
        checkElem(a,"popupField" + k,"span","popup-field",k)
        let f = checkElem(a,"","input","right","")
        f.value = (type.Params && type.Params[k])? type.Params[k] : "empty"
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

    var buildSettingsItem = (root,field,val,previd) => {

        if(val["Type"] && val["Type"] == "ServiceLaunch") {
            if(field == "Type") {
                return
            }
            else {
                let act = checkElem(root,previd + field,"div","settingsValue",field)
                act.onclick = () => { onscreenPopup({Type: val["Type"], Name: field},val[field])}
                return
            }
        }
        else if(val[field] == null || field=="MnmsData")
            return;
        else if(field === "UID" 
            || field == "_id"
            || field == "Schema"
            || field == "CurrentTime"
            ) 
            { return }

        let Id = previd + field
        let elem = checkElem(root,Id,"div","settingsItem"," ")

        if(field === "Ws")
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
        else if(field == "Workspace") {
            let toggle = checkElem(elem,"","span","settingsToggle",field)
            elem.classList.add("expanded")
            toggle.onclick = () => clickElem(elem)
            let d = checkElem(elem,"","div","settingsValue",val[field] + "")
            d.onclick = () => onscreenPopup({Type: "Workspace", Name: val[field]},{Type: "Workspace", Name: val[field]})
        }
        else if(field === "Child") {
            if(val[field])
            checkElem(elem,"","span","settingsTitle","pause")
            else
            checkElem(elem,"","span","settingsTitle","remove")
        }
        else if(field === "Type") {
            checkElem(elem,"","span","settingsValue",val[field] + "")
            elem.classList.add("alone")
        }
        else if(Array.isArray(val[field])) {
            let toggle = checkElem(elem,"","span","settingsToggle",field)
            toggle.onclick = () => {
                clickElem(elem)
                for(let l in val[field]) {
                    buildSettingsItem(elem,l,val[field],Id)
                }
            }

            //checkElem(elem,"","div","settingsTitle",k + " : Array")
            
        }
        else if(typeof val[field] === "object") {
            let toggle = checkElem(elem,"","span","settingsToggle",field)
            if(val[field].Name) toggle.innerHTML = val[field].Name
            else if(val[field].Type) {
                toggle.innerHTML = val[field].Type
                if(val[field].IP) toggle.innerHTML += ":" + val[field].IP
            }

            toggle.onclick = () => {
                clickElem(elem)
                Object.keys(val[field]).forEach(l => buildSettingsItem(elem,l,val[field],Id))
            }
        }
        else {
            let toggle = checkElem(elem,"","span","settingsToggle",field)
            elem.classList.add("expanded")
            toggle.onclick = () => clickElem(elem)
            checkElem(elem,"","div","settingsValue",val[field] + "")
        }
    } 

    Object.keys(_data).forEach((k) => buildSettingsItem(menu,k,_data,"settings"))

    buildSettingsItem(menu,"Nodes",{Nodes : _nodes},"nodes")
}

/* Selection manipulation */
let lastSelected = null;
let lastNode = null;

var selectNew = (newSelected,node) => {
    let velem = document.getElementById("vlan-sel")
    velem.oncontextmenu = vlanMenu
    velem.onclick = vlanMenu
    if(mselection.vlan == null)
    {
        velem.innerHTML = "All Vlans: untagged / trunk"
        velem.style["background-color"]=null
    }
    else{
        velem.innerHTML = "Vlan " + mselection.vlan
        velem.style["background-color"]= VlanColor(mselection.vlan)
    }
    
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
            mselection = { vlan: mselection.vlan} 
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
        mselection = { vlan: mselection.vlan} 
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

var makeDeviceInfo = (elem,update) => {
    mselection = {vlan: mselection.vlan}
    let node = elem._data.node
    selectNew("node-unit-" + node.Name,elem._data.node)
    
    let win = document.getElementById("win")
    if(!update) win.innerHTML = ""
    mselection.nodeIP = node.IP

    buildGraph(_nodes)
    checkElem(win,"win-device-name","div","win-device-name",node.Name)
    buildRefreshTimer(node,win,"win-")
    let ips = checkElem(win,"win-device-ips","div","win-device-ips"," ")
    checkElem(ips,"","div","",node.IP)
    if(node.OtherIPs) for(let i of node.OtherIPs) {
        checkElem(ips,"","div","",i)
    }
    let err = snapErrors.filter(s => s.Name == node.Name)
    if(err.length > 0) {
        let snapCont = checkElem(win,"snap-cont-left","div","","")
        let snap = checkElem(snapCont,"snapError-winleft","div","snap-error",err[0].Type)
        if(err[0].Type == "new") {
            snap.classList.remove("warn")
        }
        else {
            snap.classList.add("warn")
        }
        if(err[0].Type == "modified") {
            err[0].Data.forEach(d => {
                console.log(d)
                checkElem(snapCont,"snap-err-" + d.type,"div","",d.type + (d.data ? "<br>" + JSON.stringify(d.data) : ""))
            })
        }
    }
    else {
        checkElem(win,"snap-cont-left","div",""," ")
    }
    let services = checkElem(win,"win-device-services","div","services"," ")
    if(node.System) {
        buildSystemInfo(node,win,"left-")
    }
    else 
        checkElem(win,"left-node-actions-" + node.Name,"div","node-system-unit empty","")
    if(node.Actions) {
        buildActions(node,win,"left-")
    }
    else 
        checkElem(win,"left-node-actions-" + node.Name,"div","node-system-unit empty","")
    if(node)
    if(node.Services) {
        Object.keys(node.Services).forEach((key) => {
            let name = key.split("._")[0]
            if(key.includes("_http._tcp")) {
                let subcontainer = checkElem(services,"","div","","")
                checkElem(subcontainer,"","i","fas fa-link","")
                checkElem(subcontainer,key,{type: "a", href: "http://" + node.IP + ":" + node.Services[key].port},"http",name)
            }
            else if(key.includes("_telnet")) {
                let subcontainer = checkElem(services,"" + key,"div","","")
                checkElem(subcontainer,"" ,"i","fas fa-tty","")
                checkElem(subcontainer,"","span","",name)
            }
        })
    }
    let streams = checkElem(win,"strsub" ,"div","streams"," ")
    if(node.Services) {
        Object.keys(node.Services).forEach((key) => {
            let name = key.split("._")[0]
            if(key.includes("_rtsp._tcp")) {
                let subcontainer = checkElem(streams,"","div",""," ")
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
        checkElem(subcontainer,"win-ports-title","div","switch_port_win_text","Port - I/O Mbps - (multi)")
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
            let port = checkElem(subcontainer,"win-ports-" + p.Name,"div","switch-port-container"," ")
            let mport = checkElem(port,"","span","switch_port_win port",p.Name)
            //console.log(p)
            if(mselection.vlan) {
                if(p.Vlan) {
                    if(p.Vlan.Tagged.includes(mselection.vlan))
                        mport.style.border = "2px dashed " + VlanColor(p.Vlan.Untagged[0])
                    else if(p.Vlan.Untagged.includes(mselection.vlan))
                        mport.style.border = "2px solid " + VlanColor(p.Vlan.Untagged[0])
                    else 
                        mport.style.border = null
                }
                else {
                    mport.style.border = "1px dashed grey" 
                }
            }
            else {
                if(p.Vlan) {
                    if(p.Vlan.Tagged.length > 0)
                        mport.style.border = "2px solid grey"
                    else 
                        mport.style.border = "2px solid " + VlanColor(p.Vlan.Untagged[0])
                }
                else {
                    mport.style.border = "1px dashed grey" 
                }
            }
            //console.log(p.IGMP.ForwardAll)
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
            mport.style["border-radius"] = "10px"
        }
    }

    
}

var checkElem = (root,id,domtype,classElem,innerHTML) => {

    function isObject(val) {
        if (val === null) { return false;}
        return ( (typeof val === 'function') || (typeof val === 'object') );
    }


    let elem = null;
    if(id) elem = document.getElementById(id)
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
        if(id)    elem.id = id
        root.appendChild(elem)
    }

    if(classElem.length > 0 && elem.className != classElem)
        elem.className = classElem;
    if(elem.innerHTML != innerHTML && innerHTML.length > 0) elem.innerHTML = innerHTML
    return elem;
}

var buildSystemInfo = (node,elem,pref) => {
    let sys = checkElem(elem,pref + "node-system-" + node.Name,"div","node-system-unit","")
    let canva = cpuInfo(sys,node.System,pref)
    let mem = checkElem(sys,pref + "node-system-mem-" + node.Name,"div","node-system-mem","mem " + Math.floor(node.System.MemBusy) + "%")
    let temp = checkElem(sys,pref + "node-system-temp-" + node.Name,"div","node-system-temp","temp " + node.System.CPUTemps[0] + "°C")
    if(node.System.DiskBuzy)
        checkElem(sys,pref + "node-system-disk-" + node.Name,"div","node-system-disk","Disk<br>" + node.System.DiskBuzy + "%")
    if(node.System.offline) 
        checkElem(sys,pref + "node-system-overlay-" + node.Name,"div","node-system-overlay","Offline")
    else if(document.getElementById(pref + "node-system-overlay-" + node.Name)) {
        document.getElementById(pref + "node-system-overlay-" + node.Name).outerHTML = ""
    } 
}

var buildActions = (node,elem,pref) => {
    let sys = checkElem(elem,pref + "node-actions-" + node.Name,"div","node-actions-unit","")
    /*for(let A of node.Actions) {
        checkElem(sys,pref+A.name,'div','',A.name)
    }*/
}

var progressBar = (refreshbar,time,start) => {
    if(!refreshbar) return
    if(time <= 0) {
        console.log("Time passed")
        refreshbar.style = {}
        refreshbar.className = "node-refresh-end"
        return
    }
    if(start && refreshbar._data.timer) clearTimeout(refreshbar._data.timer) 
    if(start) refreshbar._data.maxtime = time
    refreshbar.className = "node-refresh-ongoing"
    refreshbar.style.width = (time/refreshbar._data.maxtime)*100 + "%"
    refreshbar._data.timer = setTimeout(() => progressBar(refreshbar,time-0.5,false),500)
}

var buildRefreshTimer = (node,elem,pre) => {
    let refreshcont = checkElem(elem,pre + "node-refresh-cont-" + node.Name,"div","node-refresh-container","")
    if(node._Timers) {
        let rootTimer = node._Timers.filter(k => k.path == "$")
        if(rootTimer.length > 0) {
            let refreshbar = checkElem(refreshcont,pre + "node-refresh-" + node.Name,"div","","")
            if(!refreshbar._data) refreshbar._data = {}
            if(refreshbar._data.seqnum != node.seqnum) {
                refreshbar._data.seqnum = node.seqnum
                progressBar(refreshbar,rootTimer[0].time+1,true)
            }
            return
        }
    }
    checkElem(refreshcont,pre + "node-refresh-" + node.Name,"div","node-refresh-unknown","")
}
var buildNodeNav = (node,elem) => {
    let flex_id = 1000000;
    if(0 && elem._data.node && _.isEqual(elem._data.node,node) && !snapErrors.some(s => s.Name == node.Name)) {
        checkElem(elem,"snapError-" + node.Name,"div","snap-error"," ")
        return 
    }

    elem._data.node = node
    let name = node.Name.split(".")[0]
    if(name.length > 21) {
        name = name.substr(0,12) + "..." + name.substr(-5)
    }
    elem.oncontextmenu = (e) => nodeContextMenu(node,e)
    let unit = checkElem(elem,"node-unit-" + node.Name,"div","node-unit","")
    checkElem(unit,"node-name-" + node.Name,"div",node.Type,name)
    checkElem(unit,"node-IP-" + node.Name,"div",node.Type,node.IP)
    buildRefreshTimer(node,unit)
    let err = snapErrors.filter(s => s.Name == node.Name)
    if(err.length > 0) {
        let snap = checkElem(elem,"snapError-" + node.Name,"div","snap-error",err[0].Type)
        if(err[0].Type == "new") {
            snap.classList.remove("warn")
            flex_id -= 4000;
        }
        else {
            snap.classList.add("warn")
            flex_id -= 5000;
        }
    }
    else
        checkElem(elem,"snapError-" + node.Name,"div","snap-error"," ")
    if(node.System) {
        buildSystemInfo(node,elem,"node-")
    }
    else 
        checkElem(elem,"node-node-system-" + node.Name,"div","","")
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
            let port = checkElem(subcontainer,"node-port-" + p.Name + ":" + node.Name,"div","switch_port port",p.Name)
            if(mselection.vlan) {
                if(p.Vlan) {
                    if(p.Vlan.Tagged.includes(mselection.vlan))
                        port.style.border = "2px dashed " + VlanColor(p.Vlan.Untagged[0])
                    else if(p.Vlan.Untagged.includes(mselection.vlan))
                        port.style.border = "2px solid " + VlanColor(p.Vlan.Untagged[0])
                    else 
                        port.style.border = null
                }
                else {
                    port.style.border = "1px dashed grey" 
                }
            }
            else {
                if(p.Vlan) {
                    if(p.Vlan.Tagged.length > 0)
                        port.style.border = "2px solid grey"
                    else 
                        port.style.border = "2px solid " + VlanColor(p.Vlan.Untagged[0])
                }
                else {
                    port.style.border = "1px dashed grey" 
                }
            }
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
            port.classList.remove("off")
            port.classList.remove("warn")
            port.classList.remove("dc")
            port.classList.remove("off")
            port.classList.add(classP)
            port.style["border-radius"] = "10px"
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
        if(e.nodes && e.nodes.length > 0 && document.getElementById("node-" + _nodes[e.nodes[0]].Name)) {
            makeDeviceInfo(document.getElementById("node-" + _nodes[e.nodes[0]].Name))
            let Node = document.getElementById("node-" + _nodes[e.nodes[0]].Name)
            let Container = document.getElementById("node_container")
        }
    })
    network.on('oncontext',(e) => {
        console.log('context',e,network.getNodeAt(e.pointer.DOM),network.getEdgeAt(e.pointer.DOM))
        let node = network.getNodeAt(e.pointer.DOM)
        let netElem = document.getElementById("mynetwork").getBoundingClientRect();
        if(node) {
            nodeContextMenu(_nodes[node],{x: e.pointer.DOM.x + netElem.left, y:e.pointer.DOM.y+ netElem.top})
        }
    })
}

let oldNodes = []
let oldEdges = []
let macToFind = []

var welcomeMessage = () => {
    if(!_nodes.some(k => k.Type == "switch") || (_data && _data.Switches && _data.Switches.length == 0)) {
        document.getElementById("firstSwitchMessage").classList.remove("hidden")
        if(_data.Switches.length) {
            document.getElementById("firstSwitchMessage").innerHTML = "Waiting for first switch to respond"
            document.getElementById("firstSwitchMessage").style.height = "30px"
        }
        else {
            document.getElementById("firstSwitchMessage").innerHTML = "Add a switch to start using MNMS<br><img src='switch_gif.gif'>"
            document.getElementById("firstSwitchMessage").style.height = "390px"
        }
        return;
    }
    else {
        document.getElementById("firstSwitchMessage").classList.add("hidden")
        document.getElementById("firstSwitchMessage").innerHTML = ""
    }
}

function buildGraph(nodes) {
    var zoomFactor = network.getScale();
    let newNodes = [];
    let newEdges = [];
    let newvlans = []
    welcomeMessage()
    for(let i in nodes) {
        if(nodes[i].Name) {
            if(nodes[i].Type == "switch") {
                let isRouterForStream = false;
                for(let p of nodes[i].Ports) {
                    if(p.Vlan) {
                        for(let v of p.Vlan.Untagged)
                            if(!newvlans.includes(v)) newvlans.push(v)
                        for(let v of p.Vlan.Tagged)
                            if(!newvlans.includes(v)) newvlans.push(v)
                    }
                    let color = "#0077bb"
                    let n = nodes.findIndex(k => { if(k.Type == "null") return false ; return( (k.OtherIPs && k.OtherIPs.some(l => l == p.Neighbour)) || k.IP == p.Neighbour) })
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
                        let edge = {
                            color: color,
                            width: 3,
                            style: null,
                            dashes: false
                        }
                        if(!p.Vlan) {
                            edge.with = 100
                            edge.color = "gray"
                            edge.dashes = true
                        }
                        else if(!mselection.vlan && p.Vlan.Tagged.length > 0) {
                            edge.width = 6
                            edge.color = "gray"
                        }
                        else if(!mselection.vlan && p.Vlan.Untagged.length > 0) {
                            edge.width = 6
                            edge.color = VlanColor(p.Vlan.Untagged[0])
                        }
                        else if(!mselection.vlan) {
                            edge.width = 0
                        }
                        else if(p.Vlan.Untagged.includes(mselection.vlan))  {
                            edge.width = 3
                            edge.color =  VlanColor(mselection.vlan)
                        }
                        else if(p.Vlan.Tagged.includes(mselection.vlan)) {
                            edge.width = 3
                            edge.color = VlanColor(mselection.vlan)
                            edge.dashes = [20,40]
                        }
                        else {
                            edge.width = 0
                            edge.dashes = true
                        }
                        edge_width = edge.width
                        color = edge.color
                        let highlight = false
                        for(let add of maddress) {
                            if(p.IGMP.Groups[add] == true) {
                                color = MColors[index]
                                isRouterForStream = true;
                                highlight = true
                                edge_width = 9
                            }
                            index = (index + 1)%MColors.length
                        }
                        if(mselection.nodeIP && mselection.nodeIP == nodes[n].IP)  {
                            bcolor = "#00ffff"
                            highlight = true
                        }
                        if(nodes[n].Type != "switch") newNodes.push({id: n , mass:20, label: nodes[n].Name.split(".")[0], borderWidth: 2, color: {border: bcolor, background: colorOfType(nodes[n].Type,!highlight)}, font: { color: "#00ffff"}})
                        newEdges.push({id: i + "_" + p.Name, from: i, to: n, label: "port " + p.Name, dashes: edge.dashes, color: {color : color}, width: edge_width, font: { strokeWidth: 0, color: "white"}})
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
    let doFit = false
    if(!(_.isEqual(newNodes, oldNodes))) {
        oldNodes = JSON.parse(JSON.stringify(newNodes))
        let tmp = newNodes.slice()
        visnode.update(tmp)
        console.log("new nodes")
        doFit = true
    }
    if(!(_.isEqual(newEdges, oldEdges))) {
        console.log(newEdges, oldEdges)
        oldEdges = JSON.parse(JSON.stringify(newEdges))
        let tmp = newEdges.slice()
        visedge.clear()
        visedge.update(tmp)
        console.log("new edges")
        doFit = true
    }
    mvlans = newvlans
    if(doFit)
        network.fit()
}


// Canvas
var cpuInfo = (parent,data,pref) => {
    let c = document.getElementById(pref + "canva-" + parent.id)
    if(!c)
    {
        c = document.createElement("canvas");
        c.className = "node-system-cpu"
        c.id=pref + "canva-" + parent.id;
        let ctx = c.getContext("2d");
        ctx.canvas.width  = 60;
        ctx.canvas.height = 50;
        parent.appendChild(c)
    }
    let ctx = c.getContext("2d");
    
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "white"
    
    let drawCpu = (v,r,w) => {
      ctx.beginPath();
      ctx.lineWidth=w;
      ctx.arc(26.5, 24.5, r, Math.PI*(1/2+10/60), Math.PI*(1/2 + 10/60 + v/60), false) 
        ctx.stroke();
    } 
    
    
    ctx.strokeStyle = "#333333"
    drawCpu(100,23,4)
    drawCpu(100,19,2)
    drawCpu(100,16,2)
    ctx.strokeStyle = "white"
    drawCpu(data.CPU5s,23,4)
    drawCpu(data.CPU1min,19,2)
    drawCpu(data.CPU5min,16,2)
    ctx.font = "15px Arial";
    if(data.CPUSpeeds && data.CPUSpeeds[0]) ctx.fillText(Math.floor(data.CPUSpeeds[0]*10)/10, 14, 30);
}

var vlanMenu = (e) => {
    let f = {
        Name: "vlans",
        _Actions : [{
            id: 50000,
            Name: "show all",
            type: "simple",
            action: () => {
                mselection.vlan = null
                selectNew(null,null)
                buildGraph(_nodes)
            }
        }]
    }

    let Sub = [
        {
            Name: "rename",
            action: () => {}
        },
        {
            Name: "color",
            action: () => {}
        },
        {
            Name: "select",
            action: (id) => { mselection.vlan = mvlans[id]}
        }
    ]

    let a = 0
    for(let v of mvlans) {
        f._Actions.push({
            Name: v + ": " + "vlan " + v,
            Number: v,
            Style: {
                "background-color":VlanColor(v) 
            },
            type: "simple",
            action: () => {
                mselection.vlan = v
                selectNew(null,null)
                buildGraph(_nodes)
            },
            id: a
        })
        a++
    }

    nodeContextMenu(f,e)
}

var nodeContextMenu = (node,pos) => {
    
    /*node._Actions = [{
        Name: "toggle port on/off",
        type: "applyToRange",
        label: "Name",
        path: "Ports",
        id: 1
    },{
        Name: "test cable on portf",
        type: "applyToRange",
        label: "Name",
        path: "Ports",
        id: 2
    }]*/
    let dom_items = []
    if(node.Actions) {
        let contextMenu = checkElem( document.getElementById("popupSpace"),"context-menu","div","context-menu",node.Name + "<br>---")
        contextMenu.style.top = pos.y
        contextMenu.style.left = pos.x
        contextMenu.style["z-index"] = 4000000

        // Handling appear disappear
        let vanish = () => {
            contextMenu.outerHTML = ""
        }
        let vanish_t = setTimeout(vanish,3000)
        contextMenu.onmouseover = () => clearTimeout(vanish_t)
        contextMenu.onmouseout = () => vanish_t = setTimeout(vanish,200)

        for(let A of node.Actions) {
            console.log(A)
            dom_items[A.name] = checkElem(contextMenu,"action-" + A.name,"div","context-menu-item",A.name)
            switch(A.type) {
                case "subactions":
                    dom_items[A.id].onmouseover = () =>{
                        if(document.getElementById("context-menu-sub")) document.getElementById("context-menu-sub").outerHTML = ""
                        let contextSubMenu = checkElem( contextMenu,"context-menu-sub","div","context-menu context-menu-croped","")
                        var rect = dom_items[A.id].getBoundingClientRect();
                        var rect2 = contextMenu.getBoundingClientRect();
                        contextSubMenu.style.top = rect.top - rect2.top - 10
                        contextSubMenu.style.left = rect.right - rect2.left
                        for(let item of A.Subs) {
                            let dom_item = checkElem(contextSubMenu,"context-menu-action-" + A.id + item.Name,"div","context-menu-item",item.Name)
                            dom_item.onclick = () => {
                                item.action(A.id)
                            }
                        }
                        let subvanish = () => {
                            contextSubMenu.outerHTML = ""
                        }
                        let subvanish_t
                        contextSubMenu.onmouseover = () => {clearTimeout(subvanish_t);clearTimeout(vanish_t)}
                        contextSubMenu.onmouseout = () => {subvanish_t = setTimeout(subvanish,200)}

                    }
                    break
                case "applyToRange":
                    dom_items[A.id].onmouseover = () =>{
                        if(document.getElementById("context-menu-sub")) document.getElementById("context-menu-sub").outerHTML = ""
                        let contextSubMenu = checkElem( contextMenu,"context-menu-sub","div","context-menu context-menu-croped","")
                        var rect = dom_items[A.id].getBoundingClientRect();
                        var rect2 = contextMenu.getBoundingClientRect();
                        contextSubMenu.style.top = rect.top - rect2.top - 10
                        contextSubMenu.style.left = rect.right - rect2.left
                        for(let item of node[A.path]) {
                            let dom_item = checkElem(contextSubMenu,"context-menu-action-" + A.id + item[A.label],"div","context-menu-item",item[A.label])
                            dom_item.onclick = () => {
                                console.error("Click",A,item)
                            }
                        }
                        let subvanish = () => {
                            contextSubMenu.outerHTML = ""
                        }
                        let subvanish_t
                        contextSubMenu.onmouseover = () => {clearTimeout(subvanish_t);clearTimeout(vanish_t)}
                        contextSubMenu.onmouseout = () => {subvanish_t = setTimeout(subvanish,200)}

                    }
                    break
                case "simple":
                    dom_items[A.name].onclick = () => {
                        sendAction(node.id,A,null)
                    }
                    break;
                case "missionControlAction":
                    dom_items[A.id].onclick = () => {
                        console.error("Click",A)
                    }
                    break;
                default:
                    break
            }
        }
    }
    if(pos.preventDefault) pos.preventDefault()
}

var sendAction = (nodeId,action,params) => {
    console.log('sending',action,"to",nodeId)
    missionControlWS.send(JSON.stringify({Type :"Node::action", nodeId: nodeId, action: action, params: params}))
}