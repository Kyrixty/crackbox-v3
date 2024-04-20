import { LandingStyle } from "@lib/landing";
import "@/css/grid.css";
import { randomIntFromInterval } from "@utils/rand";
import { useEffect, useState } from "react";

interface CLCProps {
  style: LandingStyle;
  onFire: boolean;
}

const getStyle = () => {
  return {
    backgroundImage: `url('/imgs/fire.gif')`,
    backgroundSize: "contain",
    backgroundRepeat: "no-repeat",
  };
};

export const CrackboxLogoCard = (props: CLCProps) => {
  const imgUrl =
    props.style === LandingStyle.Normal
      ? "/imgs/crackbox-logo-2.png"
      : "/imgs/peter.png";
  const style = props.onFire ? getStyle() : {};

  return (
    <div style={style} className="crackbox-logo-card">
      <img src={imgUrl} width={250} height={250} />
    </div>
  );
};

export const CrackboxLogoGrid = () => {
  const styles = [LandingStyle.Normal, LandingStyle.Peter];
  const [idx, _] = useState(randomIntFromInterval(0, styles.length - 1));
  const [onFire, __] = useState(randomIntFromInterval(1, 5) < 3);

  const [crackboxLogoArray, setCrackboxLogoArray] = useState<number[]>([]);
  const stylePage = () => {
    let arr = [];
    const rows = 8; // 8 (250)
    const cols = 9; // 9
    for (let i = 0; i < rows * cols; i++) {
      arr.push(i);
    }
    setCrackboxLogoArray(arr);
  };

  useEffect(() => stylePage(), []);

  return (
    <div id="crackbox-logo-grid">
      {crackboxLogoArray.map((i) => {
        return <CrackboxLogoCard onFire={onFire} style={styles[idx]} key={i} />;
      })}
    </div>
  );
};
