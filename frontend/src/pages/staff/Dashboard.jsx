import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function StaffDashboard() {
  const navigate = useNavigate()
  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Dashboard</div>
          <div className="topbar-sub">Staff view — đơn cần xử lý & tồn kho</div>
        </div>
        <div className="topbar-right">
          <div className="search-box"><span>🔍</span><input placeholder="Tìm kiếm..." /></div>
          <div className="tb-icon">🔔<span className="tb-dot"></span></div>
        </div>
      </div>

      <div className="content">
        <div className="kpi-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          <div className="kpi-card amber"><div className="kpi-bg-icon">🛒</div><div className="kpi-label">Đơn cần xử lý hôm nay</div><div className="kpi-value">8</div><div className="kpi-change dn">3 đơn mới, 5 đang giao</div></div>
          <div className="kpi-card red"><div className="kpi-bg-icon">📦</div><div className="kpi-label">Sản phẩm sắp hết hàng</div><div className="kpi-value">5</div><div className="kpi-change dn">Cần nhập thêm</div></div>
          <div className="kpi-card green"><div className="kpi-bg-icon">✅</div><div className="kpi-label">Đơn hoàn thành hôm nay</div><div className="kpi-value">12</div><div className="kpi-change up">↑ 4 so hôm qua</div></div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Đơn cần xử lý</div>
              <a className="card-link" onClick={() => navigate('/staff/orders')}>Xem tất cả →</a>
            </div>
            <table>
              <thead><tr><th>Mã đơn</th><th>Khách hàng</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                <tr>
                  <td style={{fontWeight:700}}>#ORD-1037</td><td>Võ Tưởng Tuấn Kiệt</td>
                  <td><span className="badge badge-purple">Mới</span></td>
                  <td><button className="btn btn-green btn-xs" onClick={() => navigate('/staff/orders')}>Xác nhận</button></td>
                </tr>
                <tr>
                  <td style={{fontWeight:700}}>#ORD-1041</td><td>Trần Thị Bích</td>
                  <td><span className="badge badge-amber">Đang xử lý</span></td>
                  <td><button className="btn btn-outline btn-xs" onClick={() => navigate('/staff/orders')}>Giao hàng</button></td>
                </tr>
                <tr>
                  <td style={{fontWeight:700}}>#ORD-1034</td><td>Đặng T. Hoa</td>
                  <td><span className="badge badge-purple">Mới</span></td>
                  <td><button className="btn btn-green btn-xs" onClick={() => navigate('/staff/orders')}>Xác nhận</button></td>
                </tr>
                <tr>
                  <td style={{fontWeight:700}}>#ORD-1038</td><td>Hoàng Thị Emm</td>
                  <td><span className="badge badge-blue">Đang giao</span></td>
                  <td><button className="btn btn-outline btn-xs">Theo dõi</button></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Tồn kho sắp hết</div>
              <a className="card-link" onClick={() => navigate('/staff/products')}>Quản lý →</a>
            </div>
            <table>
              <thead><tr><th>Sản phẩm</th><th>Còn lại</th><th>Trạng thái</th></tr></thead>
              <tbody>
                <tr><td>⌨️ Bàn phím Keychron</td><td style={{fontWeight:700,color:'var(--amber)'}}>4</td><td><span className="badge badge-amber">Sắp hết</span></td></tr>
                <tr><td>👕 Áo polo Uniqlo</td><td style={{fontWeight:700,color:'var(--amber)'}}>6</td><td><span className="badge badge-amber">Sắp hết</span></td></tr>
                <tr><td>🖥️ Màn hình LG 27"</td><td style={{fontWeight:700,color:'var(--amber)'}}>3</td><td><span className="badge badge-amber">Sắp hết</span></td></tr>
                <tr><td>👟 Giày Nike Air Max</td><td style={{fontWeight:700,color:'var(--accent)'}}>0</td><td><span className="badge badge-red">Hết hàng</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
