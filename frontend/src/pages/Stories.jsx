import { useNavigate } from 'react-router-dom'

// /stories route now redirects to the main feed at /
export default function Stories() {
  const navigate = useNavigate()
  navigate('/', { replace: true })
  return null
}
