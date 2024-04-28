import { Conditional } from "@components/conditional";
import { useChampdUpContext } from "@lib/context/champdup";
import { Event, EventNames } from "@lib/champdup";

interface EventConditionalProps {
  name: EventNames[] | EventNames;
  children: React.ReactNode;
}

export const EventComponent = (p: EventConditionalProps) => {
  const { currentEvent } = useChampdUpContext();
  if (!currentEvent) return <></>;
  return (
    <Conditional
      condition={
        p.name.length
          ? p.name.includes(currentEvent.name)
          : p.name === currentEvent.name
      }
      children={p.children}
    />
  );
};
