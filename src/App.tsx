import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, Deck } from './types'
import './App.css'
import { Search, Filter, Plus, Trash2, Save, Sword, UserSquare, BookOpen, Download, Upload, Image as ImageIcon } from 'lucide-react'
import ManualBattleBoard from './components/ManualBattleBoard'
import OnlineBattleBoard from './components/OnlineBattleBoard'
import { toPng } from 'html-to-image'

const getCardNumberBase = (cardNumber: string) => {
  const match = cardNumber.match(/^\d{2}-\d{3}/)
  return match ? match[0] : cardNumber
}

const DEFAULT_DECKS: Deck[] = [
  {
    name: 'グリフィンドールデッキ（ＳＴ）',
    partnerId: 'Pt001',
    mpCardId: 'MP-001',
    cardIds: [
      'S01-001', 'S01-001', 'S01-001', 'S01-001',
      'S01-002', 'S01-002', 'S01-002', 'S01-002',
      'S01-003', 'S01-003', 'S01-003', 'S01-003',
      'S01-004', 'S01-004', 'S01-004', 'S01-004',
      'S01-005', 'S01-005', 'S01-005', 'S01-005',
      'S01-006', 'S01-006', 'S01-006', 'S01-006',
      'S01-007', 'S01-007', 'S01-007', 'S01-007',
      'S01-008', 'S01-008', 'S01-008', 'S01-008',
      'S01-009', 'S01-009', 'S01-009', 'S01-009',
      'S01-010', 'S01-010',
      'S01-011', 'S01-011', 'S01-011', 'S01-011',
      'S01-012', 'S01-012', 'S01-012', 'S01-012',
      'S01-013', 'S01-013', 'S01-013', 'S01-013',
    ].sort()
  },
  {
    name: 'スリザリンデッキ（ＳＴ）',
    partnerId: 'Pt002',
    mpCardId: 'MP-002',
    cardIds: [
      'S02-001', 'S02-001', 'S02-001', 'S02-001',
      'S02-002', 'S02-002', 'S02-002', 'S02-002',
      'S02-003', 'S02-003', 'S02-003', 'S02-003',
      'S02-004', 'S02-004', 'S02-004', 'S02-004',
      'S02-005', 'S02-005', 'S02-005', 'S02-005',
      'S02-006', 'S02-006', 'S02-006', 'S02-006',
      'S02-007', 'S02-007', 'S02-007', 'S02-007',
      'S02-008', 'S02-008', 'S02-008', 'S02-008',
      'S02-009', 'S02-009', 'S02-009', 'S02-009',
      'S02-010', 'S02-010', 'S02-010', 'S02-010',
      'S01-010', 'S01-010',
      'S01-012a', 'S01-012a', 'S01-012a', 'S01-012a',
      'S01-013a', 'S01-013a', 'S01-013a', 'S01-013a',
    ].sort()
  }
]

type AppView = 'menu' | 'builder' | 'manual-battle' | 'online-battle'

function App() {
  const [view, setView] = useState<AppView>('menu')
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('All')
  const [currentDeck, setCurrentDeck] = useState<Deck>({
    name: 'New Deck',
    cardIds: []
  })
  const [savedDecks, setSavedDecks] = useState<Deck[]>([])
  const [showDeckEditor, setShowDeckEditor] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [previewCardId, setPreviewCardId] = useState<string | null>(null)
  
  const deckRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => {
      clearTimeout(handler)
    }
  }, [searchTerm])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/cards.json`)
      .then(res => res.json())
      .then(data => {
        setCards(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load cards:', err)
        setLoading(false)
      })

    const stored = localStorage.getItem('hp-tcg-decks')
    if (stored) {
      const parsed = JSON.parse(stored)
      const userDecks = parsed.filter((d: Deck) => !DEFAULT_DECKS.find(def => def.name === d.name))
      setSavedDecks([...DEFAULT_DECKS, ...userDecks])
    } else {
      setSavedDecks(DEFAULT_DECKS)
    }
  }, [])

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch = (card.cardName || '').toLowerCase().includes(searchLower) ||
                          (card.text || '').toLowerCase().includes(searchLower) ||
                          (card.cardNumber || '').toLowerCase().includes(searchLower);
      const matchesType = selectedType === 'All' || card.cardType.value === selectedType;
      return matchesSearch && matchesType;
    })
  }, [cards, debouncedSearchTerm, selectedType])
  
  const deckCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    currentDeck.cardIds.forEach(id => {
      counts[id] = (counts[id] || 0) + 1
    })
    return counts
  }, [currentDeck.cardIds])

  const deckCardNumberCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    currentDeck.cardIds.forEach(id => {
      const baseId = getCardNumberBase(id)
      counts[baseId] = (counts[baseId] || 0) + 1
    })
    return counts
  }, [currentDeck.cardIds])

  const costDistribution = useMemo(() => {
    const dist: Record<number, number> = {}
    currentDeck.cardIds.forEach(id => {
      const card = cards.find(c => c.cardNumber === id)
      if (card && card.cost !== null) {
        dist[card.cost] = (dist[card.cost] || 0) + 1
      }
    })
    return dist
  }, [currentDeck.cardIds, cards])

  const addCardToDeck = (card: Card) => {
    if (card.cardType.value === 'Partner') {
      setCurrentDeck(prev => ({ ...prev, partnerId: card.cardNumber }))
      return
    }
    if (card.cardNumber.startsWith('MP-')) {
      setCurrentDeck(prev => ({ ...prev, mpCardId: card.cardNumber }))
      return
    }
    
    const baseId = getCardNumberBase(card.cardNumber)
    const count = deckCardNumberCounts[baseId] || 0
    if (count >= 4) {
      alert('同じカード番号のカードは4枚までです。')
      return
    }
    if (currentDeck.cardIds.length >= 50) {
      alert('メインデッキは50枚までです。')
      return
    }

    setCurrentDeck(prev => ({
      ...prev,
      cardIds: [...prev.cardIds, card.cardNumber].sort()
    }))
  }

  const removeCardFromDeck = (cardNumber: string) => {
    setCurrentDeck(prev => {
      const index = prev.cardIds.indexOf(cardNumber)
      if (index > -1) {
        const newIds = [...prev.cardIds]
        newIds.splice(index, 1)
        return { ...prev, cardIds: newIds }
      }
      return prev
    })
  }

  const saveDeck = () => {
    if (!currentDeck.name.trim()) {
      alert('デッキ名を入力してください。')
      return
    }
    if (!currentDeck.partnerId) {
      alert('パートナーカードを1枚選んでください。')
      return
    }
    if (!currentDeck.mpCardId) {
      alert('MPカードを1枚選んでください。')
      return
    }
    if (currentDeck.cardIds.length !== 50) {
      alert('メインデッキは50枚である必要があります。')
      return
    }

    const newSavedDecks = [...savedDecks]
    const existingIndex = newSavedDecks.findIndex(d => d.name === currentDeck.name)
    if (existingIndex > -1) {
      newSavedDecks[existingIndex] = currentDeck
    } else {
      newSavedDecks.push(currentDeck)
    }
    setSavedDecks(newSavedDecks)
    localStorage.setItem('hp-tcg-decks', JSON.stringify(newSavedDecks))
    alert('デッキを保存しました。')
  }

  const loadDeck = (name: string) => {
    const deck = savedDecks.find(d => d.name === name)
    if (deck) {
      setCurrentDeck(deck)
      setShowDeckEditor(true)
    }
  }

  const exportDecks = () => {
    const userDecks = savedDecks.filter(d => !DEFAULT_DECKS.find(def => def.name === d.name))
    const dataStr = JSON.stringify(userDecks, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = 'hp-tcg-decks-backup.json'
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const importDecks = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader()
    const file = event.target.files?.[0]
    if (!file) return

    fileReader.onload = (e) => {
      try {
        const importedDecks = JSON.parse(e.target?.result as string) as Deck[]
        if (Array.isArray(importedDecks)) {
          const newSavedDecks = [...savedDecks]
          importedDecks.forEach(deck => {
            const existingIndex = newSavedDecks.findIndex(d => d.name === deck.name)
            if (existingIndex > -1) {
              newSavedDecks[existingIndex] = deck
            } else {
              newSavedDecks.push(deck)
            }
          })
          setSavedDecks(newSavedDecks)
          localStorage.setItem('hp-tcg-decks', JSON.stringify(newSavedDecks))
          alert('デッキをインポートしました。')
        }
      } catch (err) {
        console.error('Failed to import decks:', err)
        alert('インポートに失敗しました。正しい形式のファイルを選択してください。')
      }
    }
    fileReader.readAsText(file)
  }

  const downloadDeckImage = async () => {
    if (!deckRef.current) return
    setIsExporting(true)
    
    // Give time for images to be ready and UI to update
    setTimeout(async () => {
      try {
        const dataUrl = await toPng(deckRef.current!, { 
          cacheBust: true,
          backgroundColor: '#1a1a1a',
          style: {
            padding: '20px'
          }
        })
        const link = document.createElement('a')
        link.download = `${currentDeck.name}.png`
        link.href = dataUrl
        link.click()
      } catch (err) {
        console.error('Failed to generate image:', err)
        alert('画像の生成に失敗しました。')
      } finally {
        setIsExporting(false)
      }
    }, 500)
  }

  if (view === 'manual-battle') {
    return <ManualBattleBoard onBack={() => setView('menu')} deck={currentDeck} allCards={cards} savedDecks={savedDecks} />;
  }

  if (view === 'online-battle') {
    return <OnlineBattleBoard onBack={() => setView('menu')} allCards={cards} savedDecks={savedDecks} />;
  }

  if (loading) return <div className="loading">魔法の呪文でカードを読み込み中...</div>

  if (view === 'menu') {
    return (
      <div className="menu-container">
        <div className="menu-header">
          <h1>HP-TCG Simulator</h1>
          <p>魔法の世界へようこそ</p>
        </div>
        <div className="menu-options">
          <button className="menu-btn builder" onClick={() => setView('builder')}>
            <BookOpen size={48} />
            <span>デッキビルド</span>
            <small>デッキの作成・編集</small>
          </button>
          <button className="menu-btn simulator" onClick={() => setView('manual-battle')}>
            <UserSquare size={48} />
            <span>手動対戦</span>
            <small>シミュレーターで対戦</small>
          </button>
          <button className="menu-btn online" onClick={() => setView('online-battle')}>
            <Sword size={48} />
            <span>オンライン対戦</span>
            <small>遠くの友達と決闘</small>
          </button>
        </div>
      </div>
    )
  }

  const types = ['All', ...Array.from(new Set(cards.map(c => c.cardType.value)))]

  const previewCard = previewCardId ? cards.find(c => c.cardNumber === previewCardId) : null;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo" onClick={() => setView('menu')} style={{cursor: 'pointer'}}>
          <h1>HP-TCG Builder</h1>
        </div>
        <div className="header-actions">
          <div className="deck-select-group">
            <select onChange={e => loadDeck(e.target.value)} value="">
              <option value="" disabled>デッキを読み込む...</option>
              {savedDecks.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          
          <div className="button-group">
            <button onClick={saveDeck} title="デッキを保存" className="action-btn"><Save size={18} /> 保存</button>
            <button onClick={downloadDeckImage} title="デッキ画像を出力" className="action-btn"><ImageIcon size={18} /> 画像</button>
            <button onClick={exportDecks} title="デッキをエクスポート" className="action-btn"><Download size={18} /> 出力</button>
            <button onClick={() => fileInputRef.current?.click()} title="デッキをインポート" className="action-btn">
              <Upload size={18} /> 入力
              <input type="file" ref={fileInputRef} onChange={importDecks} style={{display: 'none'}} accept=".json" />
            </button>
            <button onClick={() => setView('menu')} className="action-btn">メニューへ戻る</button>
          </div>

          <button onClick={() => setShowDeckEditor(!showDeckEditor)} className="toggle-deck">
            {showDeckEditor ? 'カード一覧' : `デッキ編集 (${currentDeck.cardIds.length}/50)`}
          </button>
        </div>
      </header>

      <div className="main-layout">
        <aside className={`sidebar ${showDeckEditor ? 'visible' : ''}`}>
          <div className="deck-info">
            <input 
              type="text" 
              value={currentDeck.name} 
              onChange={e => setCurrentDeck({...currentDeck, name: e.target.value})}
              className="deck-name-input"
              placeholder="デッキ名を入力..."
            />
            <div className="deck-stats">
              <span className={currentDeck.cardIds.length === 50 ? 'valid' : 'invalid'}>
                Deck: {currentDeck.cardIds.length}/50
              </span>
              <span className={currentDeck.partnerId ? 'valid' : 'invalid'}>
                Partner: {currentDeck.partnerId ? 'OK' : 'None'}
              </span>
            </div>
          </div>

          <div className="cost-chart">
            <h4>Cost Curve</h4>
            <div className="chart-bars">
              {[0,1,2,3,4,5,6,7,8,9,10].map(cost => {
                const count = costDistribution[cost] || 0;
                const height = Math.min(count * 10, 100);
                return (
                  <div key={cost} className="bar-wrapper" title={`Cost ${cost}: ${count}枚`}>
                    <div className="bar" style={{ height: `${height}%` }}>
                      {count > 0 && <span className="bar-count">{count}</span>}
                    </div>
                    <span className="bar-label">{cost}嘖</span>
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className="deck-list" id="deck-list-capture" ref={deckRef}>
            {isExporting && (
               <div className="export-title">
                 <h2>{currentDeck.name}</h2>
                 <p>{currentDeck.cardIds.length}/50枚</p>
               </div>
            )}
            
            <div className="deck-grid">
              {currentDeck.partnerId && (
                <div className="deck-item-mini partner" onClick={() => setPreviewCardId(currentDeck.partnerId!)}>
                  <img 
                    src={`${import.meta.env.BASE_URL}images/${currentDeck.partnerId.replace('/', '_')}.png`} 
                    alt="Partner" 
                    className="mini-card-image"
                    loading="lazy"
                  />
                  <div className="mini-badge">P</div>
                </div>
              )}
              {currentDeck.mpCardId && (
                <div className="deck-item-mini mp-card" onClick={() => setPreviewCardId(currentDeck.mpCardId!)}>
                  <img 
                    src={`${import.meta.env.BASE_URL}images/${currentDeck.mpCardId.replace('/', '_')}.png`} 
                    alt="MP" 
                    className="mini-card-image"
                    loading="lazy"
                  />
                  <div className="mini-badge">M</div>
                </div>
              )}
              {Object.entries(deckCounts).map(([id, count]) => {
                return (
                  <div key={id} className="deck-item-mini" onClick={() => setPreviewCardId(id)}>
                    <img 
                      src={`${import.meta.env.BASE_URL}images/${id.replace('/', '_')}.png`} 
                      alt={id} 
                      className="mini-card-image"
                      loading="lazy"
                    />
                    <div className="mini-count-badge">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>

        <section className="card-explorer">
          <div className="search-bar">
            <div className="input-group">
              <Search size={20} />
              <input 
                type="text" 
                placeholder="カード名、効果、番号で検索..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <Filter size={20} />
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="card-grid">
            {filteredCards.map(card => {
              const baseId = getCardNumberBase(card.cardNumber);
              const countInDeck = deckCardNumberCounts[baseId] || 0;
              return (
                <div key={card.cardNumber} className="card-card" onClick={() => addCardToDeck(card)}>
                  <div className="card-image-container">
                    <img src={`${import.meta.env.BASE_URL}images/${card.cardNumber.replace('/', '_')}.png`} alt={card.cardName} loading="lazy" />
                    {countInDeck > 0 && (
                      <div className="card-count-badge">{countInDeck}</div>
                    )}
                    <div className="card-overlay">
                      <Plus size={32} />
                    </div>
                  </div>
                  <div className="card-info">
                    <div className="card-header">
                      <span className="card-no">{card.cardNumber}</span>
                      <span className={`card-type ${card.cardType.value}`}>{card.cardType.value}</span>
                    </div>
                    <h3 className="card-name">{card.cardName}</h3>
                    <div className="card-stats">
                      {card.cost !== null && <span className="stat-cost">C: {card.cost}</span>}
                      {card.ap !== null && <span className="stat-ap">A: {card.ap}</span>}
                      {card.dp !== null && <span className="stat-dp">D: {card.dp}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {previewCard && (
        <div className="modal-overlay" onClick={() => setPreviewCardId(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-preview">
              <img 
                src={`${import.meta.env.BASE_URL}images/${previewCard.cardNumber.replace('/', '_')}.png`} 
                alt={previewCard.cardName} 
                className="modal-card-image"
              />
              <div className="modal-info">
                <div className="modal-header">
                  <span className="card-no">{previewCard.cardNumber}</span>
                  <span className={`card-type ${previewCard.cardType.value}`}>{previewCard.cardType.value}</span>
                </div>
                <h2>{previewCard.cardName}</h2>
                <div className="card-stats">
                  {previewCard.cost !== null && <span className="stat-cost">Cost: {previewCard.cost}</span>}
                  {previewCard.ap !== null && <span className="stat-ap">AP: {previewCard.ap}</span>}
                  {previewCard.dp !== null && <span className="stat-dp">DP: {previewCard.dp}</span>}
                </div>
                <div className="modal-text">
                  {previewCard.text?.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                </div>
                <div className="modal-actions">
                  {previewCard.cardType.value === 'Partner' ? (
                    <button 
                      className="delete-btn" 
                      onClick={() => {
                        setCurrentDeck({...currentDeck, partnerId: undefined});
                        setPreviewCardId(null);
                      }}
                    >
                      <Trash2 size={20} /> パートナー解除
                    </button>
                  ) : previewCard.cardNumber.startsWith('MP-') ? (
                    <button 
                      className="delete-btn" 
                      onClick={() => {
                        setCurrentDeck({...currentDeck, mpCardId: undefined});
                        setPreviewCardId(null);
                      }}
                    >
                      <Trash2 size={20} /> MPカード解除
                    </button>
                  ) : (
                    <div className="quantity-controls">
                      <button onClick={() => removeCardFromDeck(previewCard.cardNumber)}><Trash2 size={20} /> 1枚減らす</button>
                      <span className="current-count">{deckCounts[previewCard.cardNumber] || 0}枚</span>
                      <button onClick={() => addCardToDeck(previewCard)}><Plus size={20} /> 1枚増やす</button>
                    </div>
                  )}
                  <button className="close-btn" onClick={() => setPreviewCardId(null)}>閉じる</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
