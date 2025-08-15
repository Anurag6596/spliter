import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react"; // or your API query source
import { toast } from "sonner"; // if you're using toast notifications
import { err } from "inngest/types";

export const useConvexQuery = (query, ...args) => {
  const result = useQuery(query, ...args); // Pass args if your query needs them

  const [data, setData] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (result === undefined) {
      // Still loading
      setIsLoading(true);
    } else {
      try {
        setData(result);
        setError(null);
      } catch (err) {
        setError(err);
        toast.error(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  }, [result]);

  return { data, isLoading, error };
};

export const useConvexMutation = (mutation, ...args) => {
  const mutationFn = useMutation(mutation); // Pass args if your query needs them

  const [data, setData] = useState(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const mutate = async(...args) => {
    setIsLoading(true);
    setError(null);

    try {
        const response = await mutationFn(...args);
        setData(response);
        return response;
    } catch (err) {
        setError(err);
        toast.error(err.message);
        throw err;
    } finally {
        setIsLoading(false);
    }
  };
  return {mutate, data, isLoading, error};
  
};

