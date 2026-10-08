/**
 * GeoFS Plane Duplicator - v2.0 - Adapté pour GeoFS 3.9
 * Script pour dupliquer les avions sur GeoFS
 * Touche d'activation : M
 *
 * Utilisation :
 * 1. Ouvrez GeoFS 3.9
 * 2. Ouvrez la console du navigateur (F12 > Console)
 * 3. Copiez et collez ce code entièrement
 * 4. Appuyez sur Entrée
 * 5. Appuyez sur M pour dupliquer l'avion actif
 */

(function () {
    'use strict';

    const CONFIG = {
        DUPLICATE_KEY: 'm',
        OFFSET_DISTANCE: 50,
        DUPLICATE_LIMIT: 10,
        DEBUG: false
    };

    const duplicateRegistry = {
        planes: {},
        duplicates: []
    };

    function log(message, data = null) {
        if (CONFIG.DEBUG) {
            console.log(`[GeoFS Duplicator 3.9] ${message}`, data || '');
        }
    }

    /**
     * Récupérer l'avion actif en version 3.9
     */
    function getActiveAircraft() {
        try {
            // Chemin principal GeoFS 3.9
            if (geofs && geofs.aircraft && geofs.aircraft.instance) {
                return geofs.aircraft.instance;
            }
            // Alternative
            if (window.geofs && window.geofs.aircraft && window.geofs.aircraft.instance) {
                return window.geofs.aircraft.instance;
            }
        } catch (e) {
            log('Accès à l\'avion échoué', e);
        }
        showNotification('Aucun avion actif détecté');
        return null;
    }

    /**
     * Récupérer l'ID unique de l'avion
     */
    function getAircraftId(aircraft) {
        if (!aircraft) return null;
        return aircraft.id || aircraft.name || aircraft.type || Date.now().toString();
    }

    /**
     * Récupérer la position actuelle de l'avion
     */
    function getAircraftPosition(aircraft) {
        try {
            if (!aircraft || !aircraft.state) {
                log('État de l\'avion non accessible');
                return null;
            }

            const state = aircraft.state;
            return {
                lat: state.latitude || state.lat || 0,
                lng: state.longitude || state.lng || 0,
                alt: state.altitude || state.alt || 0,
                heading: state.heading || 0,
                pitch: state.pitch || 0,
                roll: state.roll || 0
            };
        } catch (e) {
            log('Récupération position échouée', e);
            return null;
        }
    }

    /**
     * Récupérer les infos de l'avion (modèle, livrée, etc.)
     */
    function getAircraftInfo(aircraft) {
        try {
            return {
                name: aircraft.name || 'Aircraft',
                model: aircraft.type || 'Unknown',
                modelName: aircraft.modelName || aircraft.model || 'Unknown',
                livery: aircraft.livery || aircraft.texture || 'default',
                id: aircraft.id || 'unknown'
            };
        } catch (e) {
            log('Récupération infos avion échouée', e);
            return {
                name: 'Aircraft',
                model: 'Unknown',
                modelName: 'Unknown',
                livery: 'default',
                id: 'unknown'
            };
        }
    }

    /**
     * Créer une copie visuelle de l'avion
     */
    function createVisualDuplicate(aircraft, position, info) {
        try {
            // Décaler la position
            const offsetLat = position.lat + (CONFIG.OFFSET_DISTANCE / 111000);
            const offsetLng = position.lng;

            // Créer l'objet de duplication
            const duplicate = {
                id: `duplicate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: info.name,
                type: info.model,
                model: info.modelName,
                modelName: info.modelName,
                livery: info.livery,
                texture: info.livery,
                isDuplicate: true,
                isControllable: false,
                state: {
                    latitude: offsetLat,
                    longitude: offsetLng,
                    altitude: position.alt,
                    heading: position.heading,
                    pitch: position.pitch,
                    roll: position.roll
                }
            };

            // Cloner l'objet 3D si disponible
            if (aircraft.object3d) {
                try {
                    duplicate.object3d = aircraft.object3d.clone();
                    duplicate.object3d.userData = duplicate.object3d.userData || {};
                    duplicate.object3d.userData.isDuplicate = true;
                    
                    // Décaler le modèle 3D
                    if (duplicate.object3d.position) {
                        duplicate.object3d.position.x += CONFIG.OFFSET_DISTANCE;
                    }
                    
                    // Ajouter à la scène
                    if (geofs && geofs.scene) {
                        geofs.scene.add(duplicate.object3d);
                    } else if (window.scene) {
                        window.scene.add(duplicate.object3d);
                    }
                } catch (e) {
                    log('Clonage 3D échoué', e);
                }
            }

            // Enregistrer la copie
            duplicateRegistry.duplicates.push(duplicate);

            return duplicate;
        } catch (e) {
            log('Création de copie échouée', e);
            return null;
        }
    }

    /**
     * Dupliquer l'avion
     */
    function duplicateAircraft() {
        const activeAircraft = getActiveAircraft();

        if (!activeAircraft) {
            showNotification('Aucun avion actif détecté');
            return;
        }

        const aircraftId = getAircraftId(activeAircraft);

        if (!duplicateRegistry.planes[aircraftId]) {
            duplicateRegistry.planes[aircraftId] = 0;
        }

        if (duplicateRegistry.planes[aircraftId] >= CONFIG.DUPLICATE_LIMIT) {
            showNotification(`Limite de copies atteinte (${CONFIG.DUPLICATE_LIMIT})`);
            return;
        }

        try {
            const position = getAircraftPosition(activeAircraft);
            if (!position) {
                showNotification('Position de l\'avion introuvable');
                return;
            }

            const info = getAircraftInfo(activeAircraft);
            const duplicate = createVisualDuplicate(activeAircraft, position, info);

            if (duplicate) {
                duplicateRegistry.planes[aircraftId]++;
                log(`Avion dupliqué : ${info.modelName} (${info.livery})`, {
                    copies: duplicateRegistry.planes[aircraftId],
                    position
                });
                showNotification(`✓ ${info.modelName} dupliqué (${duplicateRegistry.planes[aircraftId]}/${CONFIG.DUPLICATE_LIMIT})`);
            }
        } catch (e) {
            log('Duplication échouée', e);
            showNotification('Duplication impossible');
        }
    }

    /**
     * Afficher notification visuelle
     */
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 150, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            font-family: Arial, sans-serif;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 2500);
    }

    /**
     * Gestion des touches clavier
     */
    function setupKeyboardControls() {
        document.addEventListener('keydown', function (event) {
            if (event.key.toLowerCase() === CONFIG.DUPLICATE_KEY && !event.ctrlKey && !event.altKey) {
                // Vérifier qu'on n'est pas dans un input
                const activeElement = document.activeElement;
                if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
                    event.preventDefault();
                    duplicateAircraft();
                }
            }
        });
    }

    /**
     * Réinitialiser toutes les copies
     */
    function resetDuplicates() {
        try {
            // Supprimer les copies 3D de la scène
            duplicateRegistry.duplicates.forEach(dup => {
                if (dup.object3d) {
                    try {
                        if (geofs && geofs.scene) {
                            geofs.scene.remove(dup.object3d);
                        } else if (window.scene) {
                            window.scene.remove(dup.object3d);
                        }
                    } catch (e) {
                        log('Suppression objet 3D échouée', e);
                    }
                }
            });

            duplicateRegistry.planes = {};
            duplicateRegistry.duplicates = [];
            log('Toutes les copies supprimées');
            showNotification('Copies réinitialisées');
        } catch (e) {
            log('Réinitialisation échouée', e);
        }
    }

    /**
     * Afficher les statistiques
     */
    function showStats() {
        const stats = {
            totalDuplicates: duplicateRegistry.duplicates.length,
            byAircraft: duplicateRegistry.planes,
            duplicatesList: duplicateRegistry.duplicates.map(d => ({
                id: d.id,
                model: d.modelName,
                livery: d.livery,
                lat: d.state.latitude,
                lng: d.state.longitude,
                alt: d.state.altitude
            }))
        };
        console.table(stats);
        log('Statistiques complètes', stats);
    }

    /**
     * Afficher l'aide
     */
    function showHelp() {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║           GeoFS Plane Duplicator v2.0 - GeoFS 3.9              ║
╚════════════════════════════════════════════════════════════════╝

🎮 CONTRÔLES :
   M                           Dupliquer l'avion actif
   
📋 COMMANDES CONSOLE :
   geofsDuplicator.duplicate()  Dupliquer l'avion actif
   geofsDuplicator.reset()      Supprimer toutes les copies
   geofsDuplicator.stats()      Afficher les statistiques
   geofsDuplicator.help()       Afficher cette aide
   geofsDuplicator.config()     Afficher la configuration
   
⚙️ CONFIGURATION :
   geofsDuplicator.setConfig('DUPLICATE_LIMIT', 20)
   geofsDuplicator.setConfig('OFFSET_DISTANCE', 100)
   geofsDuplicator.setConfig('DEBUG', true)

ℹ️ INFO :
   • Les copies n'are pas pilotables
   • Limite par défaut : 10 copies par avion
   • Distance de décalage : 50 mètres
   • Les copies disparaissent au changement d'avion
        `);
    }

    /**
     * Initialisation
     */
    function init() {
        try {
            setupKeyboardControls();
            log('Script initialisé pour GeoFS 3.9');
            showNotification('GeoFS Duplicator activé : M pour dupliquer');
            console.log('%cGeoFS Plane Duplicator v2.0 - GeoFS 3.9', 'color: green; font-weight: bold; font-size: 14px;');
            console.log('Appuyez sur M pour dupliquer | Tapez geofsDuplicator.help() pour l\'aide');
        } catch (e) {
            log('Initialisation échouée', e);
        }
    }

    // Exposer API globale
    window.geofsDuplicator = {
        duplicate: duplicateAircraft,
        reset: resetDuplicates,
        stats: showStats,
        help: showHelp,
        config: () => console.log(CONFIG),
        setConfig: (key, value) => {
            if (CONFIG.hasOwnProperty(key)) {
                CONFIG[key] = value;
                log(`Configuration mise à jour : ${key} = ${value}`);
                showNotification(`Config: ${key} = ${value}`);
            } else {
                console.warn(`Clé de configuration inconnue : ${key}`);
            }
        }
    };

    // Vérifier que GeoFS est chargé
    if (typeof geofs !== 'undefined' || typeof window.geofs !== 'undefined') {
        init();
    } else {
        console.warn('GeoFS n\'est pas encore chargé. Attendez le chargement complet du jeu.');
        // Réessayer après 2 secondes
        setTimeout(() => {
            if (typeof geofs !== 'undefined' || typeof window.geofs !== 'undefined') {
                init();
            }
        }, 2000);
    }
})();
