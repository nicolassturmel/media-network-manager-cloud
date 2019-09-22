export type boolString = "on" | "off" | null

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
    Neighbour?: string; 
}

export interface MnMs_node {
    Type: "switch" | "MDNS_node" | "disconnected" | "null"; 
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
}
