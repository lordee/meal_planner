import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Calendar, Utensils, X, BookOpen, Search, Check, ExternalLink, ShoppingBasket, Sparkles, Upload, Archive, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

type Recipe = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  recipeUrl?: string;
  ingredients?: string;
};

type Meal = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  recipeUrl?: string;
  ingredients?: string;
};

type DayPlan = {
  day: string;
  meals: Meal[];
};

type Week = {
  id: string;
  name: string;
  archived: boolean;
  days: DayPlan[];
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const fallbackImages = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80',
  'https://images.unsplash.com/photo-1476224489176-e8885876d19f?w=600&q=80',
  'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=600&q=80'
];

export default function App() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecipeManagerOpen, setIsRecipeManagerOpen] = useState(false);
  const [isShoppingListOpen, setIsShoppingListOpen] = useState(false);
  const [isArchivedViewOpen, setIsArchivedViewOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<{ weekId: string, day: string } | null>(null);
  const [newMeal, setNewMeal] = useState({ name: '', description: '', recipeUrl: '', ingredients: '' });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMeal, setEditingMeal] = useState<{ weekId: string, day: string, originalDay: string, meal: Meal } | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);
  const [localImages, setLocalImages] = useState<string[]>([]);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [imagePickerTarget, setImagePickerTarget] = useState<'meal' | 'recipe' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/meals').then(res => res.json()),
      fetch('/api/recipes').then(res => res.json()),
      fetch('/api/images').then(res => res.json())
    ])
      .then(([mealData, recipeData, imageData]) => {
        if (mealData.length > 0) setWeeks(mealData);
        else setWeeks([{ id: 'week-' + Date.now(), name: 'Current Week', archived: false, days: DAYS.map(day => ({ day, meals: [] })) }]);
        
        if (recipeData.length > 0) setRecipes(recipeData);
        if (imageData.length > 0) setLocalImages(imageData);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });
  }, []);

  const saveToBackend = (updatedWeeks: Week[]) => {
    fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedWeeks),
    });
  };

  const saveRecipesToBackend = (updatedRecipes: Recipe[]) => {
    fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRecipes),
    });
  };

  const addWeek = () => {
    const newWeek: Week = {
      id: 'week-' + Date.now(),
      name: 'Next Week',
      archived: false,
      days: DAYS.map(day => ({ day, meals: [] }))
    };
    const updated = [...weeks, newWeek];
    setWeeks(updated);
    saveToBackend(updated);
  };

  const archiveWeek = (weekId: string) => {
    const updated = weeks.map(w => w.id === weekId ? { ...w, archived: true } : w);
    setWeeks(updated);
    saveToBackend(updated);
  };

  const deleteWeek = (weekId: string) => {
    if (!confirm('Are you sure you want to delete this week permanently?')) return;
    const updated = weeks.filter(w => w.id !== weekId);
    setWeeks(updated);
    saveToBackend(updated);
  };

  const reuseWeek = (weekId: string) => {
    const oldWeek = weeks.find(w => w.id === weekId);
    if (!oldWeek) return;

    const newWeek: Week = {
      id: 'week-' + Date.now(),
      name: oldWeek.name + ' (Copy)',
      archived: false,
      days: oldWeek.days.map(d => ({
        ...d,
        meals: d.meals.map(m => ({ ...m, id: Math.random().toString(36).substr(2, 9) }))
      }))
    };
    const updated = [...weeks, newWeek];
    setWeeks(updated);
    saveToBackend(updated);
    setIsArchivedViewOpen(false);
  };

  const formatIngredientsWithAI = async (ingredients: string, type: 'new' | 'meal' | 'recipe') => {
    if (!ingredients.trim()) return;
    setIsFormatting(true);

    const mealId = editingMeal?.meal.id;
    const mealName = editingMeal?.meal.name;
    const recipeId = editingRecipe?.id;
    const recipeName = editingRecipe?.name;

    try {
      const response = await fetch('/api/format-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients }),
      });
      const data = await response.json();
      const formatted = data.formatted;

      if (formatted) {
        if (type === 'new') {
          setNewMeal(prev => ({ ...prev, ingredients: formatted }));
        } else if (type === 'meal' && mealId) {
          const updatedWeeks = weeks.map(w => ({
            ...w,
            days: w.days.map(d => ({
              ...d,
              meals: d.meals.map(m => m.id === mealId ? { ...m, ingredients: formatted } : m)
            }))
          }));
          setWeeks(updatedWeeks);
          saveToBackend(updatedWeeks);

          const updatedRecipes = recipes.map(r => 
            r.name.toLowerCase() === mealName?.toLowerCase() ? { ...r, ingredients: formatted } : r
          );
          setRecipes(updatedRecipes);
          saveRecipesToBackend(updatedRecipes);

          setEditingMeal(prev => (prev && prev.meal.id === mealId) ? { ...prev, meal: { ...prev.meal, ingredients: formatted } } : prev);
        } else if (type === 'recipe' && recipeId) {
          const updatedRecipes = recipes.map(r => r.id === recipeId ? { ...r, ingredients: formatted } : r);
          setRecipes(updatedRecipes);
          saveRecipesToBackend(updatedRecipes);

          const updatedWeeks = weeks.map(w => ({
            ...w,
            days: w.days.map(d => ({
              ...d,
              meals: d.meals.map(m => m.name.toLowerCase() === recipeName?.toLowerCase() ? { ...m, ingredients: formatted } : m)
            }))
          }));
          setWeeks(updatedWeeks);
          saveToBackend(updatedWeeks);

          setEditingRecipe(prev => (prev && prev.id === recipeId) ? { ...prev, ingredients: formatted } : prev);
        }
      }
    } catch (err) {
      console.error('Formatting error:', err);
    } finally {
      setIsFormatting(false);
    }
  };

  const refreshImages = () => {
    fetch('/api/images')
      .then(res => res.json())
      .then(data => setLocalImages(data))
      .catch(err => console.error('Failed to refresh images:', err));
  };

  const deleteLocalImage = async (e: React.MouseEvent, img: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this image from the server?')) return;
    
    try {
      const response = await fetch('/api/delete-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: img }),
      });
      if (response.ok) {
        refreshImages();
        // If the deleted image was currently selected in a modal, clear it
        if (editingMeal?.meal.imageUrl === img) {
          clearImage('meal');
        } else if (editingRecipe?.imageUrl === img) {
          clearImage('recipe');
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleImageUrlUpload = async (url: string, type: 'meal' | 'recipe') => {
    if (!url || !url.startsWith('http')) return;
    try {
      const response = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.imageUrl) {
        if (type === 'meal' && editingMeal) {
          setEditingMeal({ ...editingMeal, meal: { ...editingMeal.meal, imageUrl: data.imageUrl } });
        } else if (type === 'recipe' && editingRecipe) {
          setEditingRecipe({ ...editingRecipe, imageUrl: data.imageUrl });
        }
        refreshImages();
      }
    } catch (err) { console.error(err); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'meal' | 'recipe') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.imageUrl) {
        if (type === 'meal' && editingMeal) {
          setEditingMeal({ ...editingMeal, meal: { ...editingMeal.meal, imageUrl: data.imageUrl } });
        } else if (type === 'recipe' && editingRecipe) {
          setEditingRecipe({ ...editingRecipe, imageUrl: data.imageUrl });
        }
        refreshImages();
      }
    } catch (err) { console.error(err); }
  };

  const clearImage = (type: 'meal' | 'recipe') => {
    const target = type === 'meal' ? editingMeal?.meal : editingRecipe;
    if (!target) return;
    const query = encodeURIComponent(target.name.trim().replace(/\s+/g, ','));
    const defaultUrl = `https://loremflickr.com/600/400/food,meal,${query}/all`;
    if (type === 'meal' && editingMeal) setEditingMeal({ ...editingMeal, meal: { ...editingMeal.meal, imageUrl: defaultUrl } });
    else if (type === 'recipe' && editingRecipe) setEditingRecipe({ ...editingRecipe, imageUrl: defaultUrl });
  };

  const addMeal = (recipeData?: Recipe, targetWeekId?: string, targetDay?: string) => {
    const weekId = targetWeekId || selectedContext?.weekId;
    const dayName = targetDay || selectedContext?.day;
    if (!weekId || !dayName) return;
    
    let mealToAdd: Meal;
    if (recipeData) {
      mealToAdd = { ...recipeData, id: Math.random().toString(36).substr(2, 9) };
    } else {
      const name = newMeal.name.trim();
      if (!name) return;
      const existing = recipes.find(r => r.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        mealToAdd = { ...existing, id: Math.random().toString(36).substr(2, 9) };
      } else {
        const query = encodeURIComponent(name.replace(/\s+/g, ','));
        const imageUrl = `https://loremflickr.com/600/400/food,meal,${query}/all`;
        mealToAdd = { id: Math.random().toString(36).substr(2, 9), name, description: newMeal.description, imageUrl, recipeUrl: newMeal.recipeUrl, ingredients: newMeal.ingredients };
        const updatedRecipes = [...recipes, { ...mealToAdd, id: Math.random().toString(36).substr(2, 9) }];
        setRecipes(updatedRecipes);
        saveRecipesToBackend(updatedRecipes);
      }
    }

    const updatedWeeks = weeks.map(w => w.id === weekId ? {
      ...w,
      days: w.days.map(d => d.day === dayName ? { ...d, meals: [...d.meals, mealToAdd] } : d)
    } : w);

    setWeeks(updatedWeeks);
    saveToBackend(updatedWeeks);
    setNewMeal({ name: '', description: '', recipeUrl: '', ingredients: '' });
    setSearchQuery('');
    setIsModalOpen(false);
  };

  const removeMeal = (weekId: string, day: string, mealId: string) => {
    const updated = weeks.map(w => w.id === weekId ? {
      ...w,
      days: w.days.map(d => d.day === day ? { ...d, meals: d.meals.filter(m => m.id !== mealId) } : d)
    } : w);
    setWeeks(updated);
    saveToBackend(updated);
    if (editingMeal?.meal.id === mealId) setEditingMeal(null);
  };

  const updateMeal = (weekId: string, updatedMeal: Meal, newDay?: string, newWeekId?: string) => {
    let updatedWeeks = weeks.map(w => w.id === weekId ? {
      ...w,
      days: w.days.map(d => ({ ...d, meals: d.meals.filter(m => m.id !== updatedMeal.id) }))
    } : w);

    const targetWeekId = newWeekId || weekId;
    const targetDayName = newDay || (editingMeal?.originalDay || '');

    updatedWeeks = updatedWeeks.map(w => w.id === targetWeekId ? {
      ...w,
      days: w.days.map(d => d.day === targetDayName ? { ...d, meals: [...d.meals, updatedMeal] } : d)
    } : w);

    setWeeks(updatedWeeks);
    saveToBackend(updatedWeeks);

    const updatedRecipes = recipes.map(r => r.name.toLowerCase() === updatedMeal.name.toLowerCase() ? { 
      ...r, description: updatedMeal.description || '', imageUrl: updatedMeal.imageUrl || '', recipeUrl: updatedMeal.recipeUrl || '', ingredients: updatedMeal.ingredients || ''
    } : r);
    setRecipes(updatedRecipes);
    saveRecipesToBackend(updatedRecipes);
    setEditingMeal(null);
  };

  const updateRecipe = (updatedRecipe: Recipe) => {
    const oldRecipe = recipes.find(r => r.id === updatedRecipe.id);
    if (!oldRecipe) return;
    const updatedRecipes = recipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r);
    setRecipes(updatedRecipes);
    saveRecipesToBackend(updatedRecipes);

    const updatedWeeks = weeks.map(w => ({
      ...w,
      days: w.days.map(d => ({
        ...d,
        meals: d.meals.map(m => m.name.toLowerCase() === oldRecipe.name.toLowerCase() ? { ...m, ...updatedRecipe, id: m.id } : m)
      }))
    }));
    setWeeks(updatedWeeks);
    saveToBackend(updatedWeeks);
    setEditingRecipe(null);
  };

  const handleDragStartMeal = (e: React.DragEvent, weekId: string, day: string, meal: Meal) => {
    e.dataTransfer.setData('type', 'meal');
    e.dataTransfer.setData('mealId', meal.id);
    e.dataTransfer.setData('fromDay', day);
    e.dataTransfer.setData('fromWeekId', weekId);
  };

  const handleDragStartRecipe = (e: React.DragEvent, recipe: Recipe) => {
    e.dataTransfer.setData('type', 'recipe');
    e.dataTransfer.setData('recipeId', recipe.id);
  };

  const handleDrop = (e: React.DragEvent, toWeekId: string, toDay: string) => {
    const type = e.dataTransfer.getData('type');
    if (type === 'meal') {
      const mealId = e.dataTransfer.getData('mealId');
      const fromDay = e.dataTransfer.getData('fromDay');
      const fromWeekId = e.dataTransfer.getData('fromWeekId');
      if (fromDay === toDay && fromWeekId === toWeekId) return;
      const meal = weeks.find(w => w.id === fromWeekId)?.days.find(d => d.day === fromDay)?.meals.find(m => m.id === mealId);
      if (meal) updateMeal(fromWeekId, meal, toDay, toWeekId);
    } else if (type === 'recipe') {
      const recipeId = e.dataTransfer.getData('recipeId');
      const recipe = recipes.find(r => r.id === recipeId);
      if (recipe) addMeal(recipe, toWeekId, toDay);
    }
  };

  const getShoppingList = (targetWeekId?: string) => {
    const ingredientsMap: { [key: string]: { minQty: number, maxQty: number, unit: string, name: string } } = {};
    const relevantWeeks = targetWeekId ? weeks.filter(w => w.id === targetWeekId) : weeks.filter(w => !w.archived);
    
    relevantWeeks.forEach(w => w.days.forEach(d => d.meals.forEach(m => {
      if (m.ingredients) {
        m.ingredients.split('\n').forEach(line => {
          const parts = line.split('|').map(p => p.trim());
          if (parts.length < 3) return;
          const [qtyStr, unit, name] = [parts[0], parts[1], parts[2].toLowerCase()];
          let [min, max] = [0, 0];
          if (qtyStr.includes('-')) {
            const [s1, s2] = qtyStr.split('-').map(Number);
            min = isNaN(s1) ? 0 : s1; max = isNaN(s2) ? min : s2;
          } else {
            const val = parseFloat(qtyStr); min = isNaN(val) ? 1 : val; max = min;
          }
          const key = `${name}-${unit}`;
          if (ingredientsMap[key]) { ingredientsMap[key].minQty += min; ingredientsMap[key].maxQty += max; }
          else ingredientsMap[key] = { minQty: min, maxQty: max, unit, name };
        });
      }
    })));
    return Object.values(ingredientsMap);
  };

  const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeWeeks = weeks.filter(w => !w.archived);
  const archivedWeeks = weeks.filter(w => w.archived);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-emerald-600"><Utensils size={48} className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-900 flex flex-col">
      <header className="max-w-[1600px] mx-auto mb-12 flex justify-between items-end w-full">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Weekly Feast</h1>
          <p className="text-gray-500 mt-2">Plan your culinary journey.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsArchivedViewOpen(true)} className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors shadow-sm">
            <Archive size={20} />
            <span className="font-medium">Archives</span>
          </button>
          <button onClick={() => setIsShoppingListOpen(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200">
            <ShoppingBasket size={20} />
            <span className="font-medium">Shopping List</span>
          </button>
          <button onClick={() => setIsRecipeManagerOpen(true)} className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            <BookOpen size={20} />
            <span className="font-medium">Recipe Library</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 max-w-[1600px] mx-auto w-full">
        <aside className="w-full lg:w-80 flex flex-col gap-6 bg-white/50 backdrop-blur rounded-3xl border border-gray-100 p-6 shadow-sm h-fit sticky top-8">
          <h2 className="text-xl font-bold">Library</h2>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Search favorites..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm" /></div>
          <div className="max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
            {recipes.length === 0 ? <p className="text-xs text-gray-400 italic text-center py-10">No recipes yet.</p> : filteredRecipes.map(recipe => (
              <div key={recipe.id} draggable onDragStart={(e) => handleDragStartRecipe(e, recipe)} onClick={() => setEditingRecipe(recipe)} className="group flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-2xl hover:border-emerald-500 hover:shadow-md transition-all cursor-grab active:cursor-grabbing">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0"><img src={recipe.imageUrl} className="w-full h-full object-cover" onError={(e) => { const hash = recipe.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0); e.currentTarget.src = fallbackImages[hash % fallbackImages.length]; }} /></div>
                <div className="min-w-0 flex-1"><h4 className="font-bold text-xs truncate">{recipe.name}</h4><p className="text-[10px] text-gray-400 truncate">{recipe.description || 'No description'}</p></div>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col gap-12">
          {activeWeeks.map((week) => (
            <section key={week.id} className="bg-white/30 p-6 rounded-[2rem] border border-gray-100 relative">
              <div className="flex justify-between items-center mb-8 px-2">
                <input type="text" value={week.name} onChange={(e) => { const updated = weeks.map(w => w.id === week.id ? { ...w, name: e.target.value } : w); setWeeks(updated); saveToBackend(updated); }} className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg px-2" />
                <button onClick={() => archiveWeek(week.id)} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-orange-600 transition-colors"><Archive size={14} /> Archive Week</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
                {week.days.map((dayPlan) => (
                  <div key={dayPlan.day} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, week.id, dayPlan.day)} className="flex flex-col gap-4">
                    <div className="flex justify-between items-center px-1"><h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{dayPlan.day}</h2><button onClick={() => { setSelectedContext({ weekId: week.id, day: dayPlan.day }); setIsModalOpen(true); }} className="hover:bg-emerald-50 p-1.5 rounded-lg text-emerald-600 transition-colors bg-white border border-gray-100 shadow-sm"><Plus size={18} /></button></div>
                    <div className="flex flex-col gap-4 min-h-[100px] flex-1">
                      {dayPlan.meals.length === 0 ? <div className="border-2 border-dashed border-gray-200 rounded-2xl flex-1 flex items-center justify-center text-gray-300 text-[10px] py-8 text-center px-2">Drop here</div> : dayPlan.meals.map((meal) => (
                        <div key={meal.id} draggable onDragStart={(e) => handleDragStartMeal(e, week.id, dayPlan.day, meal)} onClick={() => setEditingMeal({ weekId: week.id, day: dayPlan.day, originalDay: dayPlan.day, meal })} className="group relative bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-300 cursor-pointer active:cursor-grabbing">
                          <div className="relative h-24 bg-emerald-50"><img src={meal.imageUrl} alt={meal.name} className="w-full h-full object-cover transition-opacity duration-500" onLoad={(e) => (e.currentTarget.style.opacity = '1')} style={{ opacity: 0 }} onError={(e) => { const hash = meal.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0); e.currentTarget.src = fallbackImages[hash % fallbackImages.length]; e.currentTarget.style.opacity = '1'; }} /><button onClick={(e) => { e.stopPropagation(); removeMeal(week.id, dayPlan.day, meal.id); }} className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 shadow-sm"><Trash2 size={12} /></button></div>
                          <div className="p-2"><h3 className="font-bold text-[11px] truncate leading-tight">{meal.name}</h3>{meal.recipeUrl && <div className="mt-1 text-[9px] text-emerald-600 font-semibold flex items-center gap-1"><ExternalLink size={8} /> Recipe</div>}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <button onClick={addWeek} className="w-full py-8 border-4 border-dashed border-gray-200 rounded-[2rem] text-gray-400 hover:border-emerald-200 hover:text-emerald-500 transition-all flex flex-col items-center gap-2 group"><Plus size={48} className="group-hover:scale-110 transition-transform" /><span className="font-bold text-lg">Add New Week</span></button>
        </main>
      </div>

      {/* Add Meal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div><h3 className="text-xl font-bold text-gray-900">Add Meal</h3><p className="text-xs text-gray-500">{selectedContext?.day}</p></div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <div className="relative"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Meal Name</label><input autoFocus type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setNewMeal(prev => ({ ...prev, name: e.target.value })); }} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all" placeholder="Search favorites or type new..." />
                {searchQuery && <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-10 max-h-60 overflow-y-auto p-2">{filteredRecipes.length > 0 ? filteredRecipes.map(recipe => (<button key={recipe.id} onClick={() => { setNewMeal({ name: recipe.name, description: recipe.description || '', recipeUrl: recipe.recipeUrl || '', ingredients: recipe.ingredients || '' }); setSearchQuery(recipe.name); addMeal(recipe); }} className="w-full flex items-center gap-3 p-2 hover:bg-emerald-50 rounded-xl transition-colors text-left group"><div className="w-12 h-12 rounded-lg overflow-hidden bg-emerald-50 flex-shrink-0"><img src={recipe.imageUrl} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(recipe.name)}&background=10b981&color=fff`; }} /></div><div className="min-w-0 flex-1"><h4 className="font-bold text-sm truncate">{recipe.name}</h4><p className="text-[11px] text-gray-400 truncate">{recipe.description}</p></div><Plus className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" size={18} /></button>)) : <div className="p-4 text-center"><p className="text-xs text-emerald-600 font-medium">✨ Creating new recipe!</p></div>}</div>}
              </div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label><textarea value={newMeal.description} onChange={(e) => setNewMeal({...newMeal, description: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none transition-all" /></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe URL</label><input type="text" value={newMeal.recipeUrl} onChange={(e) => setNewMeal({...newMeal, recipeUrl: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" /></div>
              <div><div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ingredients</label><button onClick={() => formatIngredientsWithAI(newMeal.ingredients, 'new')} disabled={isFormatting || !newMeal.ingredients.trim()} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"><Sparkles size={12} className={isFormatting ? "animate-pulse" : ""} /> Magic Format</button></div><textarea value={newMeal.ingredients} onChange={(e) => setNewMeal({...newMeal, ingredients: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-32 resize-none transition-all" placeholder="List ingredients here..." /></div>
              <button onClick={() => addMeal()} disabled={!searchQuery.trim()} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:bg-gray-200">Add to Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meal Modal */}
      {editingMeal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-xl font-bold text-gray-900">Edit Meal</h3>
              <button onClick={() => setEditingMeal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 border relative group/img"><img src={editingMeal.meal.imageUrl} className="w-full h-full object-cover" />{editingMeal.meal.recipeUrl && <a href={editingMeal.meal.recipeUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-emerald-600 text-xs font-bold hover:bg-white transition-colors">Open Original Recipe</a>}</div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Meal Name</label><input type="text" value={editingMeal.meal.name} onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, name: e.target.value}})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all" /></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Plan for Day</label><select value={editingMeal.day} onChange={(e) => setEditingMeal({...editingMeal, day: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all">{DAYS.map(day => (<option key={day} value={day}>{day}</option>))}</select></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label><textarea value={editingMeal.meal.description} onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, description: e.target.value}})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none transition-all" /></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe URL</label><div className="flex gap-2"><input type="text" value={editingMeal.meal.recipeUrl || ''} onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, recipeUrl: e.target.value}})} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />{editingMeal.meal.recipeUrl && <a href={editingMeal.meal.recipeUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-emerald-600 hover:bg-emerald-50 transition-colors"><ExternalLink size={20} /></a>}</div></div>
              <div><div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ingredients</label><button onClick={() => formatIngredientsWithAI(editingMeal.meal.ingredients || '', 'meal')} disabled={isFormatting || !(editingMeal.meal.ingredients || '').trim()} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"><Sparkles size={12} className={isFormatting ? "animate-pulse" : ""} /> Magic Format</button></div><textarea value={editingMeal.meal.ingredients || ''} onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, ingredients: e.target.value}})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-32 resize-none transition-all" /></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Image Source</label>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm truncate flex items-center">
                      {editingMeal.meal.imageUrl.startsWith('/uploads/') ? (
                        <span className="text-emerald-600 font-mono flex items-center gap-2">
                          <Check size={14} /> {editingMeal.meal.imageUrl}
                        </span>
                      ) : (
                        <input 
                          type="text" 
                          value={editingMeal.meal.imageUrl} 
                          onChange={(e) => setEditingMeal({...editingMeal, meal: {...editingMeal.meal, imageUrl: e.target.value}})} 
                          className="w-full bg-transparent outline-none"
                          placeholder="Paste image URL..."
                        />
                      )}
                    </div>
                    {editingMeal.meal.imageUrl.startsWith('http') && (
                      <button onClick={() => handleImageUrlUpload(editingMeal.meal.imageUrl, 'meal')} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all text-xs font-bold whitespace-nowrap">Host Locally</button>
                    )}
                    <button onClick={() => clearImage('meal')} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-xs font-bold">Reset</button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all text-sm font-bold shadow-sm">
                      <Upload size={18} /> {editingMeal.meal.imageUrl.startsWith('/uploads/') ? 'Replace' : 'Upload'}
                    </button>
                    <button onClick={() => { setImagePickerTarget('meal'); setIsImagePickerOpen(true); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all text-sm font-bold shadow-sm">
                      <BookOpen size={18} /> Browse
                    </button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'meal')} />
                </div>
              </div>
              <div className="flex gap-3"><button onClick={() => removeMeal(editingMeal.weekId, editingMeal.originalDay, editingMeal.meal.id)} className="flex-1 bg-red-50 text-red-600 font-bold py-4 rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2"><Trash2 size={18} /> Delete</button><button onClick={() => updateMeal(editingMeal.weekId, editingMeal.meal, editingMeal.day)} className="flex-[2] bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg">Save Changes</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Library Modal */}
      {isRecipeManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in duration-300">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <div className="flex items-center gap-3"><BookOpen className="text-emerald-600" /><h3 className="text-2xl font-bold text-gray-900">Recipe Library</h3></div>
              <button onClick={() => setIsRecipeManagerOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={24} /></button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="w-full md:w-80 p-8 border-r border-gray-50 bg-gray-50/20 overflow-y-auto hidden md:block">
                <h4 className="font-bold mb-6 text-gray-900">Quick Add</h4>
                <div className="flex flex-col gap-6">
                  <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Name</label><input type="text" value={newMeal.name} onChange={(e) => setNewMeal({...newMeal, name: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" /></div>
                  <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label><textarea value={newMeal.description} onChange={(e) => setNewMeal({...newMeal, description: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-32 resize-none shadow-sm" /></div>
                  <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe URL</label><input type="text" value={newMeal.recipeUrl} onChange={(e) => setNewMeal({...newMeal, recipeUrl: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm" /></div>
                  <div><div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ingredients</label><button onClick={() => formatIngredientsWithAI(newMeal.ingredients, 'new')} disabled={isFormatting || !newMeal.ingredients.trim()} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"><Sparkles size={12} className={isFormatting ? "animate-pulse" : ""} /> Magic Format</button></div><textarea value={newMeal.ingredients} onChange={(e) => setNewMeal({...newMeal, ingredients: e.target.value})} className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-32 resize-none shadow-sm" /></div>
                  <button onClick={addRecipe} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-md active:scale-95">Save to Library</button>
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="p-6 border-b border-gray-50"><div className="relative group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={20} /><input type="text" placeholder="Search your collection..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all" /></div></div>
                <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                  {recipes.length === 0 ? <p className="font-medium text-gray-300 text-center py-20">Your library is empty</p> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{recipes.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())).map(recipe => (
                    <div key={recipe.id} onClick={() => setEditingRecipe(recipe)} className="group relative bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
                      <div className="relative h-40 bg-emerald-50"><img src={recipe.imageUrl} className="w-full h-full object-cover transition-opacity duration-500" onLoad={(e) => (e.currentTarget.style.opacity = '1')} style={{ opacity: 0 }} onError={(e) => { const hash = recipe.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0); e.currentTarget.src = fallbackImages[hash % fallbackImages.length]; e.currentTarget.style.opacity = '1'; }} /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4"><p className="text-white text-xs font-medium line-clamp-2">{recipe.description}</p></div></div>
                      <div className="p-4 flex justify-between items-start"><div className="min-w-0 flex-1"><h4 className="font-bold text-gray-900 truncate">{recipe.name}</h4></div><button onClick={(e) => { e.stopPropagation(); removeRecipe(recipe.id); }} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all flex-shrink-0"><Trash2 size={18} /></button></div>
                    </div>
                  ))}</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recipe Modal */}
      {editingRecipe && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-xl font-bold text-gray-900">Edit Library Recipe</h3>
              <button onClick={() => setEditingRecipe(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 border relative group/img"><img src={editingRecipe.imageUrl} className="w-full h-full object-cover" onError={(e) => { const hash = editingRecipe.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0); e.currentTarget.src = fallbackImages[hash % fallbackImages.length]; }} />{editingRecipe.recipeUrl && <a href={editingRecipe.recipeUrl} target="_blank" rel="noopener noreferrer" className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm text-emerald-600 text-xs font-bold hover:bg-white transition-colors">Open Original Recipe</a>}</div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe Name</label><input type="text" value={editingRecipe.name} onChange={(e) => setEditingRecipe({...editingRecipe, name: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all" /></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label><textarea value={editingRecipe.description} onChange={(e) => setEditingRecipe({...editingRecipe, description: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-24 resize-none transition-all" /></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Recipe URL</label><div className="flex gap-2"><input type="text" value={editingRecipe.recipeUrl || ''} onChange={(e) => setEditingRecipe({...editingRecipe, recipeUrl: e.target.value})} className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />{editingRecipe.recipeUrl && <a href={editingRecipe.recipeUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-emerald-600 hover:bg-emerald-50 transition-colors"><ExternalLink size={20} /></a>}</div></div>
              <div><div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Ingredients</label><button onClick={() => formatIngredientsWithAI(editingRecipe.ingredients || '', 'recipe')} disabled={isFormatting || !(editingRecipe.ingredients || '').trim()} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"><Sparkles size={12} className={isFormatting ? "animate-pulse" : ""} /> Magic Format</button></div><textarea value={editingRecipe.ingredients || ''} onChange={(e) => setEditingRecipe({...editingRecipe, ingredients: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none h-32 resize-none transition-all" /></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Image Source</label>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm truncate flex items-center">
                      {editingRecipe.imageUrl.startsWith('/uploads/') ? (
                        <span className="text-emerald-600 font-mono flex items-center gap-2">
                          <Check size={14} /> {editingRecipe.imageUrl}
                        </span>
                      ) : (
                        <input 
                          type="text" 
                          value={editingRecipe.imageUrl} 
                          onChange={(e) => setEditingRecipe({...editingRecipe, imageUrl: e.target.value})} 
                          className="w-full bg-transparent outline-none"
                          placeholder="Paste image URL..."
                        />
                      )}
                    </div>
                    {editingRecipe.imageUrl.startsWith('http') && (
                      <button onClick={() => handleImageUrlUpload(editingRecipe.imageUrl, 'recipe')} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all text-xs font-bold whitespace-nowrap">Host Locally</button>
                    )}
                    <button onClick={() => clearImage('recipe')} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all text-xs font-bold">Reset</button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all text-sm font-bold shadow-sm">
                      <Upload size={18} /> {editingRecipe.imageUrl.startsWith('/uploads/') ? 'Replace' : 'Upload'}
                    </button>
                    <button onClick={() => { setImagePickerTarget('recipe'); setIsImagePickerOpen(true); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-all text-sm font-bold shadow-sm">
                      <BookOpen size={18} /> Browse
                    </button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'recipe')} />
                </div>
              </div>
              <div className="flex gap-3"><button onClick={() => { removeRecipe(editingRecipe.id); setEditingRecipe(null); }} className="flex-1 bg-red-50 text-red-600 font-bold py-4 rounded-2xl hover:bg-red-100 transition-all flex items-center justify-center gap-2"><Trash2 size={18} /> Delete</button><button onClick={() => updateRecipe(editingRecipe)} className="flex-[2] bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg">Save Changes</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Archives Modal */}
      {isArchivedViewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[80vh] animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-xl font-bold text-gray-900">Archived Weeks</h3>
              <button onClick={() => setIsArchivedViewOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              {archivedWeeks.length === 0 ? <p className="text-center py-20 text-gray-400 italic">No archived weeks yet.</p> : <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{archivedWeeks.map(week => (
                <div key={week.id} className="bg-gray-50 border border-gray-100 rounded-[2rem] p-6 flex flex-col gap-4">
                  <div className="flex justify-between items-start"><h4 className="text-lg font-bold text-gray-800">{week.name}</h4><div className="flex gap-2"><button onClick={() => reuseWeek(week.id)} title="Reuse this week" className="p-2 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors"><RotateCcw size={16} /></button><button onClick={() => deleteWeek(week.id)} title="Delete permanently" className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"><Trash2 size={16} /></button></div></div>
                  <div className="grid grid-cols-7 gap-2 border-t border-gray-100 pt-4">
                    {week.days.map(d => (
                      <div key={d.day} className="flex flex-col gap-1.5">
                        <div className="text-[10px] font-bold text-gray-400 uppercase text-center border-b border-gray-100 pb-1">{d.day.slice(0, 3)}</div>
                        <div className="flex flex-col gap-1">
                          {d.meals.length === 0 ? (
                            <div className="h-10 rounded-lg bg-gray-100/50 border border-dashed border-gray-200" />
                          ) : (
                            d.meals.map(m => (
                              <div key={m.id} className="relative group/thumb h-10 w-full">
                                <img 
                                  src={m.imageUrl} 
                                  className="w-full h-full object-cover rounded-lg shadow-sm border border-white" 
                                  alt={m.name}
                                  onError={(e) => {
                                    const hash = m.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                                    e.currentTarget.src = fallbackImages[hash % fallbackImages.length];
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                  <span className="text-[7px] text-white font-bold text-center leading-[1.1] px-1 line-clamp-2">{m.name}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Shopping List Modal */}
      {isShoppingListOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-emerald-50/50"><div className="flex items-center gap-2 text-emerald-700"><ShoppingBasket size={24} /><h3 className="text-xl font-bold">Shopping List</h3></div><button onClick={() => setIsShoppingListOpen(false)} className="p-2 hover:bg-white rounded-xl transition-colors text-gray-400"><X size={20} /></button></div>
            <div className="p-6 overflow-y-auto flex flex-col gap-4">
              {getShoppingList().length === 0 ? <p className="text-center py-10 text-gray-400">No ingredients found for this week.</p> : <div className="flex flex-col gap-2">{getShoppingList().map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100"><span className="font-medium text-gray-700 capitalize">{item.name}</span><span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">{item.minQty === item.maxQty ? (item.minQty % 1 === 0 ? item.minQty : item.minQty.toFixed(2)) : `${item.minQty % 1 === 0 ? item.minQty : item.minQty.toFixed(1)}-${item.maxQty % 1 === 0 ? item.maxQty : item.maxQty.toFixed(1)}`} {item.unit}</span></div>
              ))}</div>}
            </div>
            <div className="p-6 border-t border-gray-50 bg-gray-50/30"><button onClick={() => window.print()} className="w-full bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-2xl hover:bg-gray-100 transition-all shadow-sm flex items-center justify-center gap-2"><ImageIcon size={18} /> Print List</button></div>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      {isImagePickerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
              <h3 className="text-xl font-bold text-gray-900">Select Local Image</h3>
              <button onClick={() => setIsImagePickerOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {localImages.length === 0 ? (
                <div className="text-center py-20 text-gray-400 italic">No locally stored images found. Upload or host some first!</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {localImages.map((img) => (
                    <div 
                      key={img} 
                      onClick={() => {
                        if (imagePickerTarget === 'meal' && editingMeal) {
                          setEditingMeal({ ...editingMeal, meal: { ...editingMeal.meal, imageUrl: img } });
                        } else if (imagePickerTarget === 'recipe' && editingRecipe) {
                          setEditingRecipe({ ...editingRecipe, imageUrl: img });
                        }
                        setIsImagePickerOpen(false);
                      }}
                      className="group relative aspect-square rounded-xl overflow-hidden border border-gray-100 hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer"
                    >
                      <img src={img} className="w-full h-full object-cover" alt="Stored meal" />
                      <div className="absolute inset-0 bg-emerald-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Check className="text-white bg-emerald-600 rounded-full p-1" size={32} />
                      </div>
                      <button 
                        onClick={(e) => deleteLocalImage(e, img)}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white shadow-sm z-10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
