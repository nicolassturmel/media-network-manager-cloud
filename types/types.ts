export type boolString = "on" | "off" | "warning, IGMP version diff" | null

export interface MnMs_node_port_igmp {
    ForwardAll: boolString;
    Groups: object;
}

export interface MnMs_node_port {
    Name: string;
    ConnectedMacs: string[];
    IGMP: MnMs_node_port_igmp;
    AdminState: string;
    Speed: string | number;
    In: number;
    Out: number;
    Vlan?: {
        Untagged: number[];
        Tagged: number[];
    },
    Neighbour?: string; 
}

export interface UI_parameters {
    Ports : {
                showUnplugged: boolean;
                showPlugged: boolean;
                showOff: boolean;
            }
}

export interface SystemParams {
    CPU5s: number;
    CPU1min: number;
    CPU5min: number;
    MemBusy?: number;
    DiskBuzy?: number;
    CPUTemps?: number[];
    CPUSpeeds?: number[];
    offline?: boolean;
}

export interface node_timers {
    path: string;
    time: number;
}

export interface action_parameter {
    name: string;
    type: string;
    defaultValue: any;
}
export interface MnMs_action {
    name: string;
    description: string;
    parameters: action_parameter[];
    type: 'simple';
}



export interface MnMs_node {
    Type: "switch" | "MdnsNode" | "ManualNode" | "disconnected" | "missing" | "null"; 
    IP: string;
    OtherIPs?: string[];
    Name?: string;
    Schema: number;
    Ports?: MnMs_node_port[];
    Services?: object;
    Multicast: boolString;
    Neighbour: string;
    Mac: string;
    Macs?: string[];
    id: string;
    Capabilities?: object;
    UIParams?: UI_parameters;
    System?: SystemParams;
    _Timers?: node_timers[];
    seqnum?: number;
    Errors?: any;
    Actions?: MnMs_action[];
}
