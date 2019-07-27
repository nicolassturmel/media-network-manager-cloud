
var getJSON = function(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
      var status = xhr.status;
      if (status === 200) {
        callback(null, xhr.response);
      } else {
        callback(status, xhr.response);
      }
    };
    xhr.send();
};

function getValue()
{
    console.log("Get Value")
    getJSON("/bw", (status, resp) => {
        console.log(resp)
        Object.keys(resp.Ports).forEach(function(key) {
            if(document.getElementById("waittext")) {
                document.getElementById("waittext").outerHTML = "";
            }
            if(!document.getElementById(key)) {
                let port_div = document.createElement("div")
                let port_name = document.createElement("div")
                let port_in_bw = document.createElement("div")
                let port_out_bw = document.createElement("div")
                port_div.className = "switch_port"
                port_name.className = "switch_port_name"
                port_in_bw.className = "switch_port_in"
                port_out_bw.className = "switch_port_out"
                port_div.id = key
                port_div.appendChild(port_name)
                port_div.appendChild(port_in_bw)
                port_div.appendChild(port_out_bw)
                port_name.innerHTML = key
                document.getElementById("inner").appendChild(port_div)
            }

            port = document.getElementById(key)
            port.getElementsByClassName("switch_port_name")[0].innerHTML = key + "<br>" + resp.Ports[key].Speed 
            if(resp.Ports[key].Speed > 0) {
                let in_speed = Math.round(resp.Ports[key].In)
                let out_speed = Math.round(resp.Ports[key].Out)
                if(in_speed / resp.Ports[key].Speed < 0.6) {
                    port.getElementsByClassName("switch_port_in")[0].classList.add("speed_good")
                    port.getElementsByClassName("switch_port_in")[0].classList.remove("speed_bad")
                } else {
                    port.getElementsByClassName("switch_port_in")[0].classList.remove("speed_good")
                    port.getElementsByClassName("switch_port_in")[0].classList.add("speed_bad")
                }
                if(out_speed / resp.Ports[key].Speed < 0.6) { 
                    port.getElementsByClassName("switch_port_out")[0].classList.add("speed_good")
                    port.getElementsByClassName("switch_port_out")[0].classList.remove("speed_bad")
                } else {
                    port.getElementsByClassName("switch_port_out")[0].classList.remove("speed_good")
                    port.getElementsByClassName("switch_port_out")[0].classList.add("speed_bad")
                }
                if(in_speed == 0 && resp.Ports[key].In > 0)
                    in_speed += "+"
                if(out_speed == 0 && resp.Ports[key].Out > 0)
                    out_speed += "+"
                if(in_speed != 0)
                    in_speed += " M"
                if(out_speed != 0)
                    out_speed += " M"
                port.getElementsByClassName("switch_port_in")[0].innerHTML = in_speed
                port.getElementsByClassName("switch_port_out")[0].innerHTML = out_speed
            }
            else {
                port.getElementsByClassName("switch_port_in")[0].innerHTML = "X"
                port.getElementsByClassName("switch_port_out")[0].innerHTML = "X"
            }
            if(resp.Ports[key].AdminState != undefined && resp.Ports[key].AdminState != "Up")
            {
                document.getElementById(key).classList.add("off")
            }
            else {
                document.getElementById(key).classList.remove("off")
            }
        })
        setTimeout(getValue, 2000)
    })
}
