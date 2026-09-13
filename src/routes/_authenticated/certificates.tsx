import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/certificates')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/certificates"!</div>
}
