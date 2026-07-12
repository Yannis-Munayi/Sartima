import { useEffect, useState } from 'react'
import { useSubscription } from '../context/SubscriptionContext'
import OutfitCalendarScreen from './OutfitCalendarScreen'
import TripPlannerScreen from './TripPlannerScreen'
import ClosetScreen from './ClosetScreen'
import LaundryTab from './LaundryTab'
import WardrobeBuildScreen from './WardrobeBuildScreen'
import TodayTab from './TodayTab'
import MyOutfitsTab from './MyOutfitsTab'
import styles from './DailyLookScreen.module.css'

const TABS = [
  { id: 'closet',   label: 'My Closet'       },
  { id: 'liked',    label: 'Liked'           },
  { id: 'scout',    label: 'Shop Scout'      },
  { id: 'today',    label: "Today's Outfit"  },
  { id: 'outfits',  label: 'My Outfits'      },
  { id: 'calendar', label: 'Calendar'        },
  { id: 'trip',     label: 'Trip'            },
  { id: 'laundry',  label: 'Laundry'         },
]

export default function DailyLookScreen({ forceSubTab }) {
  const [activeTab, setActiveTab]          = useState('scout')
  const { isPro, openPaywall }             = useSubscription()

  function handleTabChange(id) {
    if (!isPro && id === 'calendar') { openPaywall('outfitCalendar'); return }
    if (!isPro && id === 'trip')     { openPaywall('tripPlans');       return }
    if (!isPro && id === 'laundry')  { openPaywall('laundry');         return }
    setActiveTab(id)
  }

  // Guide-driven navigation bypasses the paywall gate above intentionally —
  // it's a feature preview during the guided tour, not a real unlock.
  useEffect(() => {
    if (forceSubTab) setActiveTab(forceSubTab)
  }, [forceSubTab])

  return (
    <div className={styles.screen}>
      <div className={styles.subTabBar}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${styles.subTab} ${activeTab === t.id ? styles.subTabActive : ''}`}
            onClick={() => handleTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'closet'   && <ClosetScreen singleTab="closet" />}
      {activeTab === 'liked'    && <ClosetScreen singleTab="liked"  />}
      {activeTab === 'scout'    && <WardrobeBuildScreen onBack={() => setActiveTab('today')} />}
      {activeTab === 'today'    && <TodayTab />}
      {activeTab === 'outfits'  && <MyOutfitsTab />}
      {activeTab === 'calendar' && <OutfitCalendarScreen />}
      {activeTab === 'trip'     && <TripPlannerScreen />}
      {activeTab === 'laundry'  && <LaundryTab />}
    </div>
  )
}
