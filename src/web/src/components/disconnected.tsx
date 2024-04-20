import { useMessenger, READYSTATE_MAP } from "@lib/context/ws";
import "@/css/disconnected.css";
import { IconWifi2, IconWifiOff } from "@tabler/icons-react";

export const Disconnected = () => {
  const { readyState } = useMessenger();
  const rs = READYSTATE_MAP[readyState];

  if (rs === "Connecting" || rs === "Closing") return <div id="disconnected-icon"><IconWifi2 color="yellow" /></div>
  if (rs === "Closed") return <div id="disconnected-icon"><IconWifiOff color="red" /></div>
  return <></>;
};
