
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
        Object.keys(resp).forEach(function(key) {
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
            port.getElementsByClassName("switch_port_in")[0].innerHTML = Math.round(resp[key].In)
            port.getElementsByClassName("switch_port_out")[0].innerHTML = Math.round(resp[key].Out)
        })
        setTimeout(getValue, 1000)
    })
}
