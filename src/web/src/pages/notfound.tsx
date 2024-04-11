import { Text, Title } from "@mantine/core"
import { redirect } from "@utils/redirect"

export const NotFoundPage = () => {
  return (
    <div id="not-found-root">
      <Title>The page you requested could not be found.</Title>
      <Text onClick={() => redirect("/")}>Go Home</Text>
    </div>
  )  
}