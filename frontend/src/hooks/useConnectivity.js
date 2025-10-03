import { useState, useCallback } from 'react';
import { useScan } from '../context/ScanContext';

export const useConnectivity = () => {
  const [connectivity, setConnectivity] = useState({});
  const [testingConnectivity, setTestingConnectivity] = useState(new Set());
  const { testConnectivity: testConnectivityAPI } = useScan();

  const testConnectivity = useCallback(async (target) => {
    const { _id } = target;
    
    setTestingConnectivity(prev => new Set([...prev, _id]));

    try {
      const result = await testConnectivityAPI(target);
      
      if (result.success) {
        setConnectivity(prev => ({
          ...prev,
          [_id]: { 
            reachable: result.reachable, 
            testedAt: result.testedAt 
          }
        }));
      } else {
        setConnectivity(prev => ({
          ...prev,
          [_id]: { reachable: false, testedAt: new Date() }
        }));
      }
      
      return result;
    } catch (err) {
      console.error('Connectivity test failed', err);
      setConnectivity(prev => ({
        ...prev,
        [_id]: { reachable: false, testedAt: new Date() }
      }));
      return { success: false, reachable: false, error: err.message };
    } finally {
      setTestingConnectivity(prev => {
        const newSet = new Set(prev);
        newSet.delete(_id);
        return newSet;
      });
    }
  }, [testConnectivityAPI]);

  const getConnectivityStatus = useCallback((targetId) => {
    return connectivity[targetId];
  }, [connectivity]);

  const isTestingConnectivity = useCallback((targetId) => {
    return testingConnectivity.has(targetId);
  }, [testingConnectivity]);

  return {
    connectivity,
    testConnectivity,
    getConnectivityStatus,
    isTestingConnectivity
  };
};