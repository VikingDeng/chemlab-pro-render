import { useEffect, useRef } from 'react';

import { calculatePH, createEmptyState, distillChemState, getChemColor, getPreferredBoilingPhase, getTotalLiquidVolume, oxidizeFerrousHydroxide, splitChemState, ventGasSpecies } from '../chemEngine';
import type { ChemState } from '../chemEngine';

export interface PlacedItem {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  chemState: ChemState; 
  state?: string; 
  isOn?: boolean; 
  lastReactionTime?: number;
  velocity?: { x: number, y: number };
  lastPos?: { x: number, y: number };
  linkedTargetId?: string;
  rackId?: string;
  rackSlot?: number;
}

export function usePhysicsEngine(
  placedItems: PlacedItem[],
  setPlacedItems: React.Dispatch<React.SetStateAction<PlacedItem[]>>,
  setBrokenGlass: React.Dispatch<React.SetStateAction<{id: string, x: number, y: number, color: string}[]>>,
  focusedItemId: string | null,
  setFocusedItemId: React.Dispatch<React.SetStateAction<string | null>>,
  playSound: (type: 'break' | 'boil' | 'reaction', loop?: number, id?: string) => void,
  stopSound: (id: string) => void,
  showToast: (msg: string) => void
) {
  // We use requestAnimationFrame to drive the physics engine instead of setInterval for smoother execution
  const lastTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  
  // Keep refs for values used inside the loop so we don't restart the RAF unnecessarily
  const itemsRef = useRef(placedItems);
  const focusedItemIdRef = useRef(focusedItemId);

  useEffect(() => {
    itemsRef.current = placedItems;
  }, [placedItems]);

  useEffect(() => {
    focusedItemIdRef.current = focusedItemId;
  }, [focusedItemId]);

  useEffect(() => {
    const syncIronPrecipitateState = (stateLabel: string | undefined, chemState: ChemState) => {
      if (!stateLabel?.includes('precipitate_fe')) return stateLabel;
      const ferric = chemState.moles['Fe(OH)3'] || 0;
      const ferrous = chemState.moles['Fe(OH)2'] || 0;
      if (ferric <= 1e-8 && ferrous <= 1e-8) return stateLabel;
      const dominantLabel = ferric >= Math.max(1e-8, ferrous * 0.6) ? 'precipitate_fe3' : 'precipitate_fe2';
      return stateLabel.replace(/precipitate_fe[23]/g, dominantLabel);
    };

    const physicsLoop = (time: number) => {
      // Run physics update roughly every 100ms
      if (time - lastTimeRef.current < 100) {
        requestRef.current = requestAnimationFrame(physicsLoop);
        return;
      }
      lastTimeRef.current = time;
      
      const currentItems = itemsRef.current;
      const focusedId = focusedItemIdRef.current;
      
      if (currentItems.length === 0) {
         requestRef.current = requestAnimationFrame(physicsLoop);
         return;
      }
      
      let updated = false;
      let newItems = [...currentItems];
      const brokenSet = new Set<string>();
      
      const activeFlames = currentItems.filter(item => item.type === 'flame' && item.isOn);
      
      let focusedTempToSync: number | null = null;
      let focusedPhToSync: number | null = null;

      newItems = currentItems.map(item => {
        let isHeatedContainer = false;
        let isIgnited = false;
        
        if (activeFlames.length > 0) {
          isHeatedContainer = activeFlames.some(flame => {
            if (flame.id === item.id) return false;
            const dx = item.x - flame.x;
            const dy = item.y - flame.y;
            
            const isUnderneath = dy > -150 && dy < 50; 
            const isHorizontallyAligned = Math.abs(dx) < 60;
            
            return (dx*dx + dy*dy) < 15000 || (isHorizontallyAligned && isUnderneath); 
          });
          
          isIgnited = activeFlames.some(flame => {
            if (flame.id === item.id) return false;
            const dx = item.x - flame.x;
            const dy = item.y - flame.y;
            return Math.sqrt(dx*dx + dy*dy) < 60;
          });
        }

        if (item.type === 'flame' && !item.isOn) {
          if (isIgnited) {
            updated = true;
            return { ...item, isOn: true };
          }
          return item;
        }

        if (item.type === 'thermometer') {
          // Thermometer measures temp of the container it's in
          let measuredTemp = 22.4;
          const containerInside = currentItems.find(c => 
            (c.type === 'beaker' || c.type === 'flask') && 
            Math.abs(c.x - item.x) < 40 && 
            Math.abs(c.y - item.y) < 60
          );
          if (containerInside) {
             measuredTemp = containerInside.chemState.temperature;
          }
          
          if (Math.abs(item.chemState.temperature - measuredTemp) > 0.1) {
            updated = true;
            // Thermometer responds quickly but not instantly
            const rate = (measuredTemp - item.chemState.temperature) * 0.2;
            return {
              ...item,
              chemState: { ...item.chemState, temperature: item.chemState.temperature + rate }
            };
          }
          return item;
        }

        if (item.type === 'glassrod') {
          return item;
        }

        if (item.type === 'burette' && item.isOn && getTotalLiquidVolume(item.chemState) > 0) {
          updated = true;
          const dripAmount = 0.3;
          const target = currentItems.find(container => 
            (container.type === 'beaker' || container.type === 'flask' || container.type === 'testtube') &&
            Math.abs(container.x - item.x) < 40 &&
            container.y > item.y && container.y < item.y + 400
          );

          let updatedItem = item;
          if (target) {
            const { extractedState, remainingState, transferredVolume } = splitChemState(item.chemState, dripAmount, { preferredPhase: 'bottom' });
            if (transferredVolume > 0) {
              updatedItem = {
                ...item,
                chemState: remainingState,
                isOn: getTotalLiquidVolume(remainingState) > 0,
              };

              const dripEvent = new CustomEvent('buretteDrip', {
                detail: {
                  targetId: target.id,
                  reagentName: item.name,
                  amount: transferredVolume,
                  transferState: extractedState,
                }
              });
              window.dispatchEvent(dripEvent);
            }
          }

          if (getTotalLiquidVolume(updatedItem.chemState) <= 0) {
            updatedItem = { ...updatedItem, isOn: false, chemState: { ...updatedItem.chemState, volume: 0, organicVolume: 0 } };
          }

          return updatedItem;
        }
        
        if ((item.type === 'beaker' || item.type === 'flask' || item.type === 'testtube')) {
          let updatedItem = { ...item };
          const gasLoadBefore = (item.chemState.moles.CO2 || 0) + (item.chemState.moles.Cl2 || 0) + (item.chemState.moles.O2 || 0);
          if (gasLoadBefore > 1e-8) {
            updatedItem = { ...updatedItem, chemState: ventGasSpecies(item.chemState, 0.1) };
            updated = true;
          }

          const dynamicBoilPoint = updatedItem.chemState.boilingPoint || 100;
          let currentTemp = updatedItem.chemState.temperature;
          let currentGlassTemp = updatedItem.chemState.glassTemp || currentTemp;
          const totalLiquidVolume = getTotalLiquidVolume(updatedItem.chemState);
          
          // --- Interaction with Glass Rod ---
          // If a glass rod is placed inside this container, apply stirring effects
          const isStirred = currentItems.some(rod => 
            rod.type === 'glassrod' && 
            Math.abs(rod.x - item.x) < 40 && 
            Math.abs(rod.y - item.y) < 60
          );

          const ferrousHydroxide = updatedItem.chemState.moles['Fe(OH)2'] || 0;
          if (ferrousHydroxide > 1e-8) {
            const airExposure = item.type === 'testtube' ? 0.7 : item.type === 'flask' ? 0.9 : 1.05;
            const agitation = isStirred ? 1 : Math.min(1, Math.abs(item.velocity?.x || 0) / 220 + Math.abs(item.velocity?.y || 0) / 260);
            const oxidizedState = oxidizeFerrousHydroxide(updatedItem.chemState, 0.1, { airExposure, agitation });
            if (oxidizedState.moles['Fe(OH)3'] !== updatedItem.chemState.moles['Fe(OH)3'] || oxidizedState.moles['Fe(OH)2'] !== updatedItem.chemState.moles['Fe(OH)2']) {
              updatedItem = {
                ...updatedItem,
                chemState: oxidizedState,
                state: syncIronPrecipitateState(updatedItem.state, oxidizedState),
              };
              updated = true;
            }
          }

          if (isStirred && updatedItem.state?.includes('precipitate') && updatedItem.lastReactionTime) {
            const timeSinceReaction = Date.now() - updatedItem.lastReactionTime;
            if (timeSinceReaction > 2000) { 
              // Resuspend settled precipitates (reset reaction time to "now" so they float back up)
              updatedItem.lastReactionTime = Date.now();
              updated = true;
            }
          }
          
          if (isHeatedContainer) {
            updated = true;
            // 1. Heat the glass wall directly (flame is very hot, heats glass quickly)
            const flameHeatRate = 1.2; // Smoother and slower heating 
            currentGlassTemp = Math.min(800, currentGlassTemp + flameHeatRate);

            if (totalLiquidVolume <= 0) {
              // Dry heating
              currentTemp = currentGlassTemp;
              
              // SUBLIMATION PHASE (I2 solid)
              if (updatedItem.chemState.moles['I2_s'] && currentTemp > 80) { // Starts sublimating visibly around 80C
                const subRate = Math.max(0.01, (currentTemp - 80) * 0.005);
                const currentI2 = updatedItem.chemState.moles['I2_s'];
                if (currentI2 > 0) {
                   const newI2 = Math.max(0, currentI2 - subRate);
                   const condensedI2 = Math.max(0, currentI2 - newI2);
                   updatedItem = {
                      ...updatedItem,
                      chemState: {
                        ...updatedItem.chemState,
                        temperature: currentTemp,
                        glassTemp: currentGlassTemp,
                        moles: { ...updatedItem.chemState.moles, 'I2_s': newI2 }
                      },
                      state: 'gas_i2', // special state for purple gas
                      lastReactionTime: Date.now()
                   };
                   
                   // Distillation transfer of Iodine vapor
                   const tube = currentItems.find(i => i.type === 'tube');
                   if (tube) {
                      const sources = currentItems.filter(i => i.type === 'flask' || i.type === 'beaker');
                      const sorted = sources.sort((a, b) => {
                         const distA = Math.pow(a.x - tube.x, 2) + Math.pow(a.y - tube.y, 2);
                         const distB = Math.pow(b.x - tube.x, 2) + Math.pow(b.y - tube.y, 2);
                         return distA - distB;
                      });
                      if (sorted.length >= 2 && sorted[0].id === item.id && condensedI2 > 0) {
                         const depositionState = createEmptyState();
                         depositionState.temperature = currentTemp;
                         depositionState.glassTemp = currentGlassTemp;
                         depositionState.moles['I2_s'] = condensedI2;

                         // Deposition in the target container
                         const customEvent = new CustomEvent('buretteDrip', {
                           detail: {
                             targetId: sorted[1].id,
                             reagentName: '碘单质 (I₂ 固体)',
                             transferState: depositionState,
                           }
                         });
                         window.dispatchEvent(customEvent);
                      }
                   }
                   
                   return updatedItem;
                }
              }


              updatedItem = {
                ...updatedItem,
                chemState: { ...updatedItem.chemState, temperature: currentTemp, glassTemp: currentGlassTemp }
              };
              
              if (currentTemp > 150) { 
                brokenSet.add(item.id);
                setBrokenGlass(prev => [...prev, { id: item.id, x: item.x, y: item.y, color: getChemColor(item.chemState) }]);
                playSound('break', 0, item.id);
                showToast("⚠️ 容器空烧导致局部过热，玻璃破裂！");
                
                if (focusedId === item.id) {
                   setFocusedItemId(null); 
                   const customEvent = new CustomEvent('tempSync', { detail: { temp: 22.4, ph: 7.0 }});
                   window.dispatchEvent(customEvent);
                }
                return item;
              }
            } 
            else {
              // Liquid present - heat transfer from glass to liquid
              const heatTransferCoef = 0.15; // Heat transfer rate glass -> water
              const tempDiff = currentGlassTemp - currentTemp;
              const heatTransferred = tempDiff * heatTransferCoef;
              
              // Liquid gains temp based on volume (mass)
              const heatGainRate = Math.max(0.01, heatTransferred / Math.max(10, (totalLiquidVolume / 20)));
              currentTemp = Math.min(dynamicBoilPoint, currentTemp + heatGainRate);
              
              // Glass loses some heat to liquid (cools down glass slightly)
              currentGlassTemp = Math.max(currentTemp, currentGlassTemp - (heatTransferred * 0.5));
              
              if (currentTemp < dynamicBoilPoint) {
                const state = currentTemp >= (dynamicBoilPoint - 0.5) ? 
                  (item.state ? (item.state.includes('gas_boil') ? item.state : `${item.state}_gas_boil`) : 'gas_boil') 
                  : item.state;
                
                if (currentTemp >= (dynamicBoilPoint - 0.5) && updatedItem.chemState.temperature < (dynamicBoilPoint - 0.5)) {
                  playSound('reaction');
                  playSound('boil', 0, item.id);
                }
                
                updatedItem = {
                  ...updatedItem,
                  state,
                  chemState: { ...updatedItem.chemState, temperature: currentTemp, glassTemp: currentGlassTemp }
                };
              } 
              else {
                // Boiling phase
            const volumeLossRate = Math.max(0.1, (currentGlassTemp - dynamicBoilPoint) * 0.05);
            const boilingPhase = getPreferredBoilingPhase(updatedItem.chemState);
            const { extractedState: distillateState, remainingState, transferredVolume: actualVolumeLoss } = distillChemState(updatedItem.chemState, volumeLossRate);
            const remainingTotalVolume = getTotalLiquidVolume(remainingState);

            // Check if there is a distillation tube connected
            const tube = currentItems.find(i => i.type === 'tube');
            if (tube) {
               // Find 2 closest containers to tube
               const sources = currentItems.filter(i => i.type === 'flask' || i.type === 'beaker');
               const sorted = sources.sort((a, b) => {
                  const distA = Math.pow(a.x - tube.x, 2) + Math.pow(a.y - tube.y, 2);
                  const distB = Math.pow(b.x - tube.x, 2) + Math.pow(b.y - tube.y, 2);
                  return distA - distB;
               });
               
               if (sorted.length >= 2 && sorted[0].id === item.id && actualVolumeLoss > 0) {
                 const targetContainer = sorted[1];
                 const cooledDistillate = {
                   ...distillateState,
                   temperature: Math.max(22.4, dynamicBoilPoint - 5),
                   glassTemp: Math.max(22.4, dynamicBoilPoint - 5),
                 };

                 // Transfer condensed pure water to the target container
                 const customEvent = new CustomEvent('buretteDrip', {
                   detail: {
                     targetId: targetContainer.id,
                     reagentName: boilingPhase === 'organic' ? '有机馏分' : '蒸馏水',
                     transferState: cooledDistillate,
                   }
                 });
                 window.dispatchEvent(customEvent);
               }
            }
                
                if (remainingTotalVolume <= 0) {
                  brokenSet.add(item.id);
                  setBrokenGlass(prev => [...prev, { id: item.id, x: item.x, y: item.y, color: getChemColor(updatedItem.chemState) }]);
                  playSound('break', 0, item.id);
                  showToast("⚠️ 液体蒸干引发局部过热，容器破裂！");
                  
                  if (focusedId === item.id) {
                     setFocusedItemId(null); 
                     const customEvent = new CustomEvent('tempSync', { detail: { temp: 22.4, ph: 7.0 }});
                     window.dispatchEvent(customEvent);
                  }
                  
                  return item; 
                }
                
                playSound('boil', 0, item.id);

                const state = updatedItem.state ? (updatedItem.state.includes('gas_boil') ? updatedItem.state : `${updatedItem.state}_gas_boil`) : 'gas_boil';
                const nextChemState = {
                  ...remainingState,
                  temperature: dynamicBoilPoint,
                  glassTemp: currentGlassTemp,
                };

                updatedItem = { 
                  ...updatedItem, 
                  state,
                  chemState: nextChemState
                };
              }
            }
          } else {
            // Cooling phase
            if (currentGlassTemp > 22.4 || currentTemp > 22.4) {
              updated = true;
              
              // 1. Glass cools to room temperature
              const glassCoolingRate = Math.max(0.05, (currentGlassTemp - 22.4) * 0.02);
              currentGlassTemp = Math.max(22.4, currentGlassTemp - glassCoolingRate);
              
              // 2. Liquid cools towards glass temp and room temp
              if (getTotalLiquidVolume(updatedItem.chemState) > 0) {
                const liquidCoolingRate = Math.max(0.02, Math.abs(currentTemp - 22.4) * 0.015);
                
                if (currentTemp > 22.4) {
                   currentTemp = Math.max(22.4, currentTemp - liquidCoolingRate);
                } else if (currentTemp < 22.4) { // E.g. endothermic reaction cooled it below room temp
                   currentTemp = Math.min(22.4, currentTemp + liquidCoolingRate);
                }
                
                const state = currentTemp < (dynamicBoilPoint - 0.5) && updatedItem.state?.includes('gas_boil') ? 
                  (updatedItem.state.replace('_gas_boil', '').replace('gas_boil', '') || undefined) 
                  : updatedItem.state;
                  
                if (currentTemp < (dynamicBoilPoint - 0.5)) {
                  stopSound(item.id);
                }
                
                updatedItem = {
                  ...updatedItem,
                  state,
                  chemState: { ...updatedItem.chemState, temperature: currentTemp, glassTemp: currentGlassTemp }
                };
              } else {
                updatedItem = {
                  ...updatedItem,
                  chemState: { ...updatedItem.chemState, glassTemp: currentGlassTemp, temperature: currentGlassTemp }
                }
              }
            }
          }

          const residualGasLoad = (updatedItem.chemState.moles.CO2 || 0) + (updatedItem.chemState.moles.Cl2 || 0) + (updatedItem.chemState.moles.O2 || 0);
          if (residualGasLoad <= 1e-8 && updatedItem.state && ['gas_co2', 'gas_cl2', 'redox_kmno4'].includes(updatedItem.state)) {
            updatedItem = { ...updatedItem, state: undefined };
          }
          updatedItem = { ...updatedItem, state: syncIronPrecipitateState(updatedItem.state, updatedItem.chemState) };
          
          if (focusedId === item.id) {
            focusedTempToSync = updatedItem.chemState.temperature;
            focusedPhToSync = calculatePH(updatedItem.chemState);
          }
          
          return updatedItem;
        }
        
        return item;
      });

      if (brokenSet.size > 0) {
        newItems = newItems.filter(i => !brokenSet.has(i.id));
        updated = true;
      }

      if (focusedTempToSync !== null) { 
        const customEvent = new CustomEvent('tempSync', { detail: { temp: focusedTempToSync, ph: focusedPhToSync }});
        window.dispatchEvent(customEvent);
      } else if (updated && focusedId === null) {
        const customEvent = new CustomEvent('tempSync', { detail: { temp: 22.4, ph: 7.0 }});
        window.dispatchEvent(customEvent);
      }

      if (updated) {
        setPlacedItems(newItems);
      }
      
      requestRef.current = requestAnimationFrame(physicsLoop);
    };

    requestRef.current = requestAnimationFrame(physicsLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [playSound, setBrokenGlass, setFocusedItemId, setPlacedItems, showToast, stopSound]);
}
