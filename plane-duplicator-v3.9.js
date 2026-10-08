/**
 * GeoFS Plane Duplicator - v2.1 - Adapté pour GeoFS 3.9
 * Script pour dupliquer les avions sur GeoFS
 * Touche personnalisée : Shift + D (changeable)
 * Bouton cliquable dans l'interface du jeu
 *
 * Utilisation :
 * 1. Ouvrez GeoFS 3.9
 * 2. Ouvrez la console du navigateur (F12 > Console)
 * 3. Copiez et collez ce code entièrement
 * 4. Appuyez sur Entrée
 * 5. Cliquez sur le bouton "Dupliquer Avion" ou utilisez Shift + D
 */

(function () {
    'use strict';

    const CONFIG = {
        DUPLICATE_KEY: 'shift+d', // Touche pour dupliquer (Shift + D)
        OFFSET_DISTANCE: 50, // Distance de séparation entre l'avion et sa copie (en mètres)
        DUPLICATE_LIMIT: 10, // Limite de copies par avion
        DEBUG: true // Mode debug activé pour diagnostiquer
    };

    const duplicateRegistry = {
        planes: {},
        duplicates: []
    };

    function log(message, data = null) {
        console.log(`[GeoFS Duplicator 3.9] ${message}`, data || '');
        if (CONFIG.DEBUG) {
            console.log('Debug Info:', { timestamp: new Date().toISOString(), message, data });
        }
    }

    /**
     * Récupérer l'avion actif en version 3.9
     */
    function getActiveAircraft() {
        try {
            // Vérifier geofs global
            if (typeof geofs !== 'undefined' && geofs.aircraft && geofs.aircraft.instance) {
                log('Avion trouvé via geofs.aircraft.instance');
                return geofs.aircraft.instance;
            }
            // Vérifier window.geofs
            if (window.geofs && window.geofs.aircraft && window.geofs.aircraft.instance) {
                log('Avion trouvé via window.geofs.aircraft.instance');
                return window.geofs.aircraft.instance;
            }
            // Fallback : chercher dans l'objet global
            if (window.aircraft && window.aircraft.instance) {
                log('Avion trouvé via window.aircraft.instance');
                return window.aircraft.instance;
            }
        } catch (e) {
            log('Accès à l\'avion échoué', e);
        }
        return null;
    }

    /**
     * Déboguer la structure de l'avion actif
     */
    function debugAircraftStructure() {
        const aircraft = getActiveAircraft();
        if (!aircraft) {
            log('Impossible de déboguer : aucun avion trouvé');
            return;
        }

        log('Structure complète de l\'avion:', aircraft);
        log('Clés de l\'objet avion:', Object.keys(aircraft));

        // Chercher les informations de position
        if (aircraft.state) {
            log('State de l\'avion:', aircraft.state);
        }
        if (aircraft.position) {
            log('Position de l\'avion:', aircraft.position);
        }
        if (aircraft.location) {
            log('Location de l\'avion:', aircraft.location);
        }

        // Chercher latitude/longitude directement
        log('Latitude directe:', aircraft.latitude);
        log('Longitude directe:', aircraft.longitude);
        log('Altitude directe:', aircraft.altitude);
    }

    /**
     * Récupérer l'ID unique de l'avion
     */
    function getAircraftId(aircraft) {
        if (!aircraft) return null;
        return aircraft.id || aircraft.name || aircraft.type || Date.now().toString();
    }

    /**
     * Récupérer la position actuelle de l'avion - VERSION AMÉLIORÉE
     */
    function getAircraftPosition(aircraft) {
        try {
            if (!aircraft) {
                log('Erreur : aircraft est null/undefined');
                return null;
            }

            log('Tentative de récupération de position...');

            // Priorité 1 : aircraft.state (GeoFS 3.9)
            if (aircraft.state) {
                log('Position trouvée dans aircraft.state');
                const state = aircraft.state;
                if (state.latitude !== undefined && state.longitude !== undefined) {
                    return {
                        lat: state.latitude,
                        lng: state.longitude,
                        alt: state.altitude || 0,
                        heading: state.heading || 0,
                        pitch: state.pitch || 0,
                        roll: state.roll || 0
                    };
                }
            }

            // Priorité 2 : aircraft.position
            if (aircraft.position) {
                log('Position trouvée dans aircraft.position');
                const pos = aircraft.position;
                return {
                    lat: pos.latitude || pos.lat || 0,
                    lng: pos.longitude || pos.lng || 0,
                    alt: pos.altitude || pos.alt || 0,
                    heading: aircraft.heading || 0,
                    pitch: aircraft.pitch || 0,
                    roll: aircraft.roll || 0
                };
            }

            // Priorité 3 : accès direct aux propriétés
            if (aircraft.latitude !== undefined && aircraft.longitude !== undefined) {
                log('Position trouvée en accès direct (latitude/longitude)');
                return {
                    lat: aircraft.latitude,
                    lng: aircraft.longitude,
                    alt: aircraft.altitude || 0,
                    heading: aircraft.heading || 0,
                    pitch: aircraft.pitch || 0,
                    roll: aircraft.roll || 0
                };
            }

            // Priorité 4 : chercher latitude/longitude dans geofs global
            if (typeof geofs !== 'undefined' && geofs.aircraft && geofs.aircraft.position) {
                log('Position trouvée dans geofs.aircraft.position');
                const pos = geofs.aircraft.position;
                return {
                    lat: pos.latitude || pos.lat || 0,
                    lng: pos.longitude || pos.lng || 0,
                    alt: pos.altitude || pos.alt || 0,
                    heading: 0,
                    pitch: 0,
                    roll: 0
                };
            }

            log('Aucune position trouvée. Structure aircraft:', aircraft);
            return null;
        } catch (e) {
            log('Exception lors de getAircraftPosition', e);
            return null;
        }
    }

    /**
     * Récupérer les infos de l'avion (modèle, livrée, etc.)
     */
    function getAircraftInfo(aircraft) {
        try {
            if (!aircraft) {
                log('aircraft est null/undefined dans getAircraftInfo');
                return null;
            }

            return {
                name: aircraft.name || 'Aircraft',
                model: aircraft.type || aircraft.model || 'Unknown',
                modelName: aircraft.modelName || aircraft.type || aircraft.model || 'Unknown',
                livery: aircraft.livery || aircraft.texture || 'default',
                id: aircraft.id || 'unknown'
            };
        } catch (e) {
            log('Exception lors de getAircraftInfo', e);
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
            if (!position) {
                log('Position est null, impossible de créer la copie');
                return null;
            }

            // Décaler la position
            const offsetLat = position.lat + (CONFIG.OFFSET_DISTANCE / 111000);
            const offsetLng = position.lng;

            log('Création de copie avec position décalée', {
                lat: offsetLat,
                lng: offsetLng
            });

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
                    log('Clonage de l\'objet 3D...');
                    duplicate.object3d = aircraft.object3d.clone();
                    duplicate.object3d.userData = duplicate.object3d.userData || {};
                    duplicate.object3d.userData.isDuplicate = true;

                    // Décaler le modèle 3D
                    if (duplicate.object3d.position) {
                        duplicate.object3d.position.x += CONFIG.OFFSET_DISTANCE;
                    }

                    // Ajouter à la scène
                    if (typeof geofs !== 'undefined' && geofs.scene) {
                        geofs.scene.add(duplicate.object3d);
                        log('Objet 3D ajouté à geofs.scene');
                    } else if (window.scene) {
                        window.scene.add(duplicate.object3d);
                        log('Objet 3D ajouté à window.scene');
                    }
                } catch (e) {
                    log('Clonage 3D échoué (non critique)', e);
                    // Continuer même si le clonage échoue
                }
            } else {
                log('object3d non disponible dans l\'avion');
            }

            // Enregistrer la copie
            duplicateRegistry.duplicates.push(duplicate);
            log('Copie enregistrée dans duplicateRegistry');

            return duplicate;
        } catch (e) {
            log('Création de copie échouée', e);
            return null;
        }
    }

    /**
     * Dupliquer l'avion - VERSION AMÉLIORÉE AVEC DIAGNOSTICS
     */
    function duplicateAircraft() {
        log('=== DÉBUT DUPLICATION ===');

        const activeAircraft = getActiveAircraft();
        if (!activeAircraft) {
            log('Aucun avion actif détecté');
            showNotification('Aucun avion actif détecté');
            debugAircraftStructure();
            return;
        }

        log('Avion actif trouvé:', activeAircraft);

        const aircraftId = getAircraftId(activeAircraft);
        log('ID de l\'avion:', aircraftId);

        if (!duplicateRegistry.planes[aircraftId]) {
            duplicateRegistry.planes[aircraftId] = 0;
        }

        if (duplicateRegistry.planes[aircraftId] >= CONFIG.DUPLICATE_LIMIT) {
            showNotification(`Limite de copies atteinte (${CONFIG.DUPLICATE_LIMIT})`);
            log('Limite de copies atteinte');
            return;
        }

        try {
            const position = getAircraftPosition(activeAircraft);
            log('Position récupérée:', position);

            if (!position) {
                log('Position de l\'avion introuvable - cela signifie que les coordonnées (latitude/longitude) de l\'avion n\'ont pas pu être trouvées dans la structure de données GeoFS');
                showNotification('Position introuvable - vérifiez la console');
                return;
            }

            const info = getAircraftInfo(activeAircraft);
            log('Info avion récupérée:', info);

            const duplicate = createVisualDuplicate(activeAircraft, position, info);

            if (duplicate) {
                duplicateRegistry.planes[aircraftId]++;
                log(`Avion dupliqué avec succès : ${info.modelName} (${info.livery})`);
                showNotification(`✓ ${info.modelName} dupliqué (${duplicateRegistry.planes[aircraftId]}/${CONFIG.DUPLICATE_LIMIT})`);
            } else {
                log('createVisualDuplicate a retourné null');
                showNotification('Duplication impossible');
            }
        } catch (e) {
            log('Exception lors de la duplication', e);
            showNotification('Duplication impossible - vérifiez la console');
        }

        log('=== FIN DUPLICATION ===');
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
        }, 3000);
    }

    /**
     * Créer le bouton cliquable dans le jeu
     */
    function createDuplicateButton() {
        try {
            const button = document.createElement('button');
            button.id = 'geofs-duplicator-button';
            button.textContent = '📋 Dupliquer Avion';
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                z-index: 9999;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
                font-family: Arial, sans-serif;
            `;

            button.addEventListener('mouseenter', () => {
                button.style.transform = 'translateY(-2px)';
                button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
            });

            button.addEventListener('mouseleave', () => {
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
            });

            button.addEventListener('click', () => {
                log('Bouton cliqué - déclenchement duplication');
                duplicateAircraft();
            });

            document.body.appendChild(button);
            log('Bouton de duplication créé avec succès');
            return button;
        } catch (e) {
            log('Erreur création bouton', e);
            return null;
        }
    }

    /**
     * Gestion des touches clavier
     */
    function setupKeyboardControls() {
        document.addEventListener('keydown', function (event) {
            const isShiftD = event.shiftKey && event.key.toLowerCase() === 'd';
            const activeElement = document.activeElement;
            const isInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';

            if (isShiftD && !isInput) {
                event.preventDefault();
                log('Combinaison Shift+D activée');
                duplicateAircraft();
            }
        });
    }

    /**
     * Réinitialiser toutes les copies
     */
    function resetDuplicates() {
        try {
            duplicateRegistry.duplicates.forEach(dup => {
                if (dup.object3d) {
                    try {
                        if (typeof geofs !== 'undefined' && geofs.scene) {
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
║           GeoFS Plane Duplicator v2.1 - GeoFS 3.9              ║
╚════════════════════════════════════════════════════════════════╝

🎮 CONTRÔLES :
   Shift + D                   Dupliquer l'avion actif
   Cliquez sur le bouton       Dupliquer l'avion actif
   
📋 COMMANDES CONSOLE :
   geofsDuplicator.duplicate()  Dupliquer l'avion actif
   geofsDuplicator.reset()      Supprimer toutes les copies
   geofsDuplicator.stats()      Afficher les statistiques
   geofsDuplicator.debug()      Afficher la structure de l'avion
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
   • Bouton situé en bas à droite de l'écran
   • Mode DEBUG activé pour diagnostiquer les problèmes
        `);
    }

    /**
     * Initialisation
     */
    function init() {
        try {
            setupKeyboardControls();
            createDuplicateButton();
            log('Script initialisé pour GeoFS 3.9');
            showNotification('GeoFS Duplicator activé : Shift+D ou cliquez le bouton');
            console.log('%cGeoFS Plane Duplicator v2.1 - GeoFS 3.9', 'color: green; font-weight: bold; font-size: 14px;');
            console.log('Appuyez sur Shift+D ou cliquez le bouton | Tapez geofsDuplicator.help() pour l\'aide');
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
        debug: debugAircraftStructure,
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
        setTimeout(() => {
            if (typeof geofs !== 'undefined' || typeof window.geofs !== 'undefined') {
                init();
            }
        }, 2000);
    }
})();
