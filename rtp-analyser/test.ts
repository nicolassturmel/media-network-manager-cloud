
import { RTPReceiver } from "./rtp"

var R = new RTPReceiver("239.2.1.135",5004,98)



setInterval(() => console.log(R.getInfos()), 2000 )