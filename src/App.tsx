import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import PackOpen from './pages/PackOpen'
import Inventory from './pages/Inventory'
import Market from './pages/Market'
import ItemDetail from './pages/ItemDetail'
import WheelPage from './pages/WheelPage'
import BattlePass from './pages/BattlePass'
import Transactions from './pages/Transactions'
import TradeUp from './pages/TradeUp'
import Admin from './pages/Admin'
import Referral from './pages/Referral'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pack-open" element={<PackOpen />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/market" element={<Market />} />
      <Route path="/item/:id" element={<ItemDetail />} />
      <Route path="/wheel" element={<WheelPage />} />
      <Route path="/battle-pass" element={<BattlePass />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/trade-up" element={<TradeUp />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/referral" element={<Referral />} />
    </Routes>
  )
}
