/**
 * GeoFS Plane Duplicator - v1.0
 * Script pour dupliquer les avions sur GeoFS
 * Touche d'activation : M
 *
 * Utilisation :
 * 1. Copiez ce code
 * 2. Ouvrez la console GeoFS (F12 > Console)
 * 3. Collez le code et appuyez sur Entrée
 * 4. Appuyez sur M pour dupliquer l'avion actif
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
        planes: {}
    };

    function log(message, data = null) {
        if (CONFIG.DEBUG) {
            console.log(`[GeoFS Duplicator] ${message}`, data || '');
        }
    }

    function getActiveAircraft() {
        if (window.geofs && window.geofs.aircraft && window.geofs.aircraft.active) {
            return window.geofs.aircraft.active;
        }
        if (window.aircraft && window.aircraft.object) {
            return window.aircraft.object;
        }
        log('Aucun avion actif détecté');
        return null;
    }

    function getAircraftId(aircraft) {
        return aircraft.id || aircraft.name || aircraft.model || 'unknown';
    }

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
                showNotification('Impossible de récupérer la position de l\'avion');
                return;
            }

            const duplicate = createVisualDuplicate(activeAircraft, position);

            if (duplicate) {
                duplicateRegistry.planes[aircraftId]++;
                log(`Avion dupliqué ! (Copie #${duplicateRegistry.planes[aircraftId]})`, {
                    aircraft: activeAircraft.name || activeAircraft.model,
                    position
                });
                showNotification(`Avion dupliqué (${duplicateRegistry.planes[aircraftId]}/${CONFIG.DUPLICATE_LIMIT})`);
            }
        } catch (error) {
            log('Le script n\'a pas pu terminer la duplication', error);
            showNotification('Duplication impossible');
        }
    }

    function getAircraftPosition(aircraft) {
        try {
            if (aircraft.position) {
                return {
                    lat: aircraft.position.latitude || aircraft.position.lat || 0,
                    lng: aircraft.position.longitude || aircraft.position.lng || 0,
                    alt: aircraft.position.altitude || aircraft.position.alt || 0
                };
            }

            if (aircraft.location) {
                return {
                    lat: aircraft.location.latitude || aircraft.location.lat || 0,
                    lng: aircraft.location.longitude || aircraft.location.lng || 0,
                    alt: aircraft.location.altitude || aircraft.location.alt || 0
                };
            }

            return {
                lat: aircraft.latitude || 0,
                lng: aircraft.longitude || 0,
                alt: aircraft.altitude || 0
            };
        } catch (error) {
            log('Position introuvable', error);
            return null;
        }
    }

    function createVisualDuplicate(aircraft, position) {
        try {
            const offsetLat = position.lat + (CONFIG.OFFSET_DISTANCE / 111000);
            const offsetLng = position.lng;

            const duplicate = {
                id: `duplicate_${Date.now()}_${Math.random()}`,
                name: aircraft.name || 'Duplicate Aircraft',
                model: aircraft.model || 'Unknown',
                livery: aircraft.livery || aircraft.texture || 'default',
                position: {
                    latitude: offsetLat,
                    longitude: offsetLng,
                    altitude: position.alt
                },
                heading: aircraft.heading || 0,
                pitch: aircraft.pitch || 0,
                roll: aircraft.roll || 0,
                isDuplicate: true,
                isControllable: false,
                visible: true
            };

            if (window.geofs && window.geofs.aircraft && window.geofs.aircraft.list) {
                window.geofs.aircraft.list.push(duplicate);
            }

            if (window.THREE && aircraft.object) {
                createThreeJSDuplicate(aircraft, duplicate, offsetLat, offsetLng);
            }

            return duplicate;
        } catch (error) {
            log('La copie n\'a pas pu être créée', error);
            return null;
        }
    }

    function createThreeJSDuplicate(aircraft, duplicateData, lat, lng) {
        try {
            if (!aircraft.object) return false;

            const clonedObject = aircraft.object.clone();

            if (window.geofs && window.geofs.map) {
                clonedObject.position.x += CONFIG.OFFSET_DISTANCE;
            }

            clonedObject.userData.isDuplicate = true;
            clonedObject.userData.isControllable = false;

            if (window.scene) {
                window.scene.add(clonedObject);
            }

            duplicateData.object = clonedObject;
            return true;
        } catch (error) {
            log('La copie 3D n\'a pas pu être ajoutée à la scène', error);
            return false;
        }
    }

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
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 2500);
    }

    function setupKeyboardControls() {
        document.addEventListener('keydown', function (event) {
            if (event.key.toLowerCase() === CONFIG.DUPLICATE_KEY) {
                event.preventDefault();
                duplicateAircraft();
            }
        });
    }

    function resetDuplicates() {
        duplicateRegistry.planes = {};
        log('Les copies ont été réinitialisées');
    }

    function showStats() {
        console.table(duplicateRegistry.planes);
        log('Statistiques de duplication', duplicateRegistry);
    }

    function init() {
        setupKeyboardControls();
        log('Script initialisé');
        log(`Touche de duplication : M`);
        showNotification('GeoFS Duplicator activé : appuyez sur M');
    }

    window.geofsDuplicator = {
        duplicate: duplicateAircraft,
        reset: resetDuplicates,
        stats: showStats,
        config: () => console.log(CONFIG),
        setConfig: (key, value) => {
            CONFIG[key] = value;
            log(`Configuration mise à jour : ${key} = ${value}`);
        }
    };

    init();
})();
