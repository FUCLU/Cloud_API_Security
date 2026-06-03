export default function OrderRow({ order }) {
  return (
    <tr>
      <td>{order?.id}</td>
      <td>{order?.status}</td>
      <td>{order?.total}</td>
    </tr>
  )
}
