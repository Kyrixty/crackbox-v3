import { ImageData } from "@lib/champdup";
import { Card, Group, Image, Text } from "@mantine/core";

export interface ImageCandidateProps {
  image?: ImageData;
}

export const HostImageCandidate = ({ image }: ImageCandidateProps) => {
  if (!image) return <></>;
  return (
    <Card shadow="lg" radius="sm">
      <Group justify="center">
        <Text>{image.title}</Text>
      </Group>
      <Card.Section>
        <Image src={image.dUri} />
      </Card.Section>
    </Card>
  );
};
