import { GameStatus, useGameContext } from "@lib/context/game";
import { useUserContext } from "@lib/context/user";

export interface ConditionalProps {
  children: React.ReactNode;
}

export interface GenericCondtionalProps extends ConditionalProps {
  condition: boolean;
}

export const Conditional = (p: GenericCondtionalProps) => {
  if (!p.condition) return <></>;
  return <>{p.children}</>;
};

export const HostComponent = (p: ConditionalProps) => {
  const { isHost } = useUserContext();
  return <Conditional condition={isHost} children={p.children} />;
};

export const PlayerComponent = (p: ConditionalProps) => {
  const { isHost } = useUserContext();
  return <Conditional condition={!isHost} children={p.children} />;
};

interface StatusCompProps extends ConditionalProps {
  status_name: GameStatus;
}

export const StatusComponent = (p: StatusCompProps) => {
  const { status } = useGameContext();
  return (
    <Conditional children={p.children} condition={p.status_name === status} />
  );
};
