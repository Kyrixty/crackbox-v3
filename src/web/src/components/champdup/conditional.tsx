import { Conditional } from "@components/conditional";
import { useChampdUpContext } from "@lib/context/champdup";
import { Event } from "@lib/champdup";

interface EventConditionalProps {
  name: Event;
  children: React.ReactNode;
}

export const EventComponent = (p: EventConditionalProps) => {
  const {currentEvent} = useChampdUpContext();
  return <Conditional condition={currentEvent === p.name} children={p.children} />
}